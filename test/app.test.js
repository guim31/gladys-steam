// -----------------------------------------------------------------------------
// The integration end to end, on the SDK's fake Gladys and the fake Steam:
// discovery, states, scene events, the container's own refresh, persistence,
// errors, the action and the scene action.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createWorld } from './helpers/world.js';
import { ID1, ID2, ID3, createFakeSteam } from './helpers/fakeSteam.js';
import { HEARTBEAT_MS } from '../src/app.js';

const deviceOf = (gladys, steamid) => gladys.externalIds('account', steamid).device;

test('one device per account, named after the persona, keyed by SteamID64', async () => {
  const world = await createWorld();
  try {
    const devices = world.gladys.fake.discoveredDevices;
    assert.deepEqual(
      devices.map((device) => [device.name, device.external_id]),
      [
        ['Steam testaccount1', `ext:test-integration:account:${ID1}`],
        ['Steam testaccount2', `ext:test-integration:account:${ID2}`],
        ['Steam unconfigured_account', `ext:test-integration:account:${ID3}`],
      ],
    );
    assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
    // Nothing added to Gladys yet: no state sent, no event.
    assert.deepEqual(world.gladys.fake.states, []);
  } finally {
    await world.cleanup();
  }
});

test('a custom name and a profile URL are resolved to the same device ids', async () => {
  const world = await createWorld({
    config: { accounts: `testaccount1, https://steamcommunity.com/profiles/${ID2}/, nobody` },
  });
  try {
    assert.deepEqual(
      world.gladys.fake.discoveredDevices.map((device) => device.external_id),
      [deviceOf(world.gladys, ID1), deviceOf(world.gladys, ID2)],
    );
  } finally {
    await world.cleanup();
  }
});

test('adding a device publishes all its states at once', async () => {
  const world = await createWorld();
  try {
    await world.add(ID1);
    const last = (key) => world.gladys.fake.lastState(world.feature(ID1, key));
    assert.equal(last('status'), 'Online');
    assert.equal(last('online'), 1);
    assert.equal(last('in_game'), 1);
    assert.equal(last('game'), 'The Witcher: Enhanced Edition');
    assert.equal(last('session'), 0);
    assert.equal(last('level'), 10);
    assert.equal(last('playtime_2weeks'), 7.1); // (396 + 30) / 60
    assert.match(last('last_logoff'), /26/);
    // The other accounts are not added: nothing published for them.
    assert.ok(world.gladys.fake.states.every((s) => s.device_feature_external_id.includes(ID1)));
    assert.ok(world.gladys.fake.widgetRefreshes.includes('accounts'));
  } finally {
    await world.cleanup();
  }
});

test('the timer refreshes the states without any onPoll from the core', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const world = await createWorld({ timers: true, config: { refresh_interval: '30' } });
  try {
    await world.add(ID1);
    let poll = 0;
    t.mock.method(world.app.handlers, 'poll', async () => {
      poll += 1;
    });
    world.steam.stop(ID1);
    t.mock.timers.tick(30000);
    // Let the cycle started by the timer finish.
    for (let i = 0; i < 20; i += 1) await new Promise((resolve) => setImmediate(resolve));
    assert.equal(world.gladys.fake.lastState(world.feature(ID1, 'in_game')), 0);
    assert.equal(world.gladys.fake.lastState(world.feature(ID1, 'game')), 'None');
    assert.equal(poll, 0);
  } finally {
    await world.cleanup();
  }
});

test("the core's onPoll is skipped right after a refresh, and runs one when overdue", async () => {
  const world = await createWorld();
  try {
    const device = await world.add(ID1);
    const before = world.steam.calls('GetPlayerSummaries').length;
    assert.deepEqual(await world.gladys.fake.poll(device), { success: true });
    assert.equal(world.steam.calls('GetPlayerSummaries').length, before);
    world.clock.now += 61000;
    await world.gladys.fake.poll(device);
    assert.equal(world.steam.calls('GetPlayerSummaries').length, before + 1);
  } finally {
    await world.cleanup();
  }
});

test('only changes are published, plus a heartbeat', async (t) => {
  // The SDK dates its heartbeat with Date.now().
  t.mock.timers.enable({ apis: ['Date'], now: Date.parse('2026-10-15T18:00:00Z') });
  const world = await createWorld();
  try {
    await world.add(ID2); // busy, not playing: nothing moves
    const count = world.gladys.fake.states.length;
    await world.tick(1);
    await world.tick(1);
    assert.equal(world.gladys.fake.states.length, count);
    t.mock.timers.tick(HEARTBEAT_MS);
    world.clock.now += HEARTBEAT_MS;
    await world.app.cycle();
    assert.ok(world.gladys.fake.states.length > count);
  } finally {
    await world.cleanup();
  }
});

test('one request per refresh for every account; details every 30 minutes, added devices only', async () => {
  const world = await createWorld();
  try {
    await world.add(ID1);
    const summaries = world.steam.calls('GetPlayerSummaries').length;
    const levels = world.steam.calls('GetSteamLevel').length;
    assert.equal(levels, 1);
    for (let i = 0; i < 29; i += 1) await world.tick(1);
    assert.equal(world.steam.calls('GetPlayerSummaries').length, summaries + 29);
    assert.equal(world.steam.calls('GetSteamLevel').length, 1);
    await world.tick(1);
    assert.equal(world.steam.calls('GetSteamLevel').length, 2);
    assert.equal(world.steam.calls('GetRecentlyPlayedGames').length, 2);
  } finally {
    await world.cleanup();
  }
});

test('scene events carry the account, its name and the game', async () => {
  const world = await createWorld();
  try {
    world.steam.stop(ID1);
    world.steam.set(ID3, { personastate: 0 });
    await world.tick(1);
    world.steam.play(ID1, '620', 'Portal 2');
    world.steam.set(ID3, { personastate: 1 });
    await world.tick(1);
    for (let i = 0; i < 15; i += 1) await world.tick(1);
    world.steam.stop(ID1);
    await world.tick(1);
    const events = world.gladys.fake.sceneEvents.map(({ key, data }) => ({ key, ...data }));
    const account = deviceOf(world.gladys, ID1);
    assert.deepEqual(events, [
      // ID1 stops The Witcher (first refresh after the baseline).
      {
        key: 'game_stopped',
        account,
        account_name: 'testaccount1',
        game: 'The Witcher: Enhanced Edition',
        game_id: '20900',
        minutes: 1,
      },
      {
        key: 'game_started',
        account,
        account_name: 'testaccount1',
        game: 'Portal 2',
        game_id: '620',
      },
      {
        key: 'went_online',
        account: deviceOf(world.gladys, ID3),
        account_name: 'unconfigured_account',
        status: 'Online',
      },
      {
        key: 'playing_for',
        account,
        account_name: 'testaccount1',
        minutes: 15,
        session_minutes: 15,
        game: 'Portal 2',
        game_id: '620',
      },
      {
        key: 'game_stopped',
        account,
        account_name: 'testaccount1',
        game: 'Portal 2',
        game_id: '620',
        minutes: 16,
      },
    ]);
  } finally {
    await world.cleanup();
  }
});

test('a restart in the middle of a session keeps counting (state in /data)', async () => {
  const steam = createFakeSteam();
  const first = await createWorld({ steam });
  let second;
  try {
    for (let i = 0; i < 10; i += 1) await first.tick(1);
    await first.app.stop();
    const saved = JSON.parse(await readFile(path.join(first.dir, 'steam-state.json'), 'utf8'));
    assert.equal(saved.tracks[ID1].sessionStart, Date.parse('2026-10-15T18:00:00Z'));
    assert.ok(!JSON.stringify(saved).includes('ABCDEF'), 'no API key in /data');

    second = await createWorld({ steam, dataDir: first.dir, connect: false });
    second.clock.now = first.clock.now + 2 * 60000;
    await second.gladys.connect();
    for (let i = 0; i < 4; i += 1) await second.tick(1);
    const reached = second.gladys.fake.sceneEvents.filter((e) => e.key === 'playing_for');
    assert.deepEqual(
      reached.map((e) => e.data.minutes),
      [15],
    );
    // The restart itself fired no game_started: the game was already known.
    assert.ok(!second.gladys.fake.sceneEvents.some((e) => e.key === 'game_started'));
  } finally {
    await second?.cleanup();
    await first.cleanup();
  }
});

test('a refused key is reported in the Configuration screen, and its recovery too', async () => {
  const world = await createWorld({ config: { api_key: 'WRONGKEY0123456789' } });
  try {
    const status = world.gladys.fake.connectionStatus;
    assert.equal(status.connected, false);
    assert.match(status.message.en, /refused the API key/);
    // Fixed in the configuration.
    await world.gladys.fake.configUpdated({
      ...world.gladys.fake.config,
      api_key: 'ABCDEF0123456789ABCDEF0123456789',
    });
    assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });
  } finally {
    await world.cleanup();
  }
});

test('Steam down: one status change, then recovery; a 429 pauses the refreshes', async () => {
  const world = await createWorld();
  try {
    world.steam.failure = { error: 'ECONNRESET' };
    await world.tick(1);
    await world.tick(1);
    const statuses = world.gladys.fake.connectionStatuses;
    assert.equal(statuses.filter((s) => s.connected === false).length, 1);
    world.steam.failure = null;
    await world.tick(1);
    assert.deepEqual(world.gladys.fake.connectionStatus, { connected: true });

    world.steam.failure = { status: 429 };
    await world.tick(1);
    const calls = world.steam.requests.length;
    world.steam.failure = null;
    await world.tick(1);
    await world.tick(1);
    assert.equal(world.steam.requests.length, calls, 'no request during the pause');
    await world.tick(4);
    assert.equal(world.steam.requests.length, calls + 1);
  } finally {
    await world.cleanup();
  }
});

test('not configured: a clear status, no device, no request', async () => {
  const steam = createFakeSteam();
  const world = await createWorld({ steam, config: { api_key: '', accounts: '' } });
  try {
    assert.equal(world.gladys.fake.connectionStatus.connected, false);
    assert.match(world.gladys.fake.connectionStatus.message.fr, /clé d'API/);
    assert.deepEqual(world.gladys.fake.discoveredDevices, []);
    assert.equal(steam.requests.length, 0);
    const widget = await world.gladys.fake.widgetGet('accounts', { language: 'de' });
    assert.match(widget.data.content.components[0].text, /API-Schlüssel/);
  } finally {
    await world.cleanup();
  }
});

test('the scan request publishes the accounts again', async () => {
  const world = await createWorld();
  try {
    const before = world.gladys.fake.requests.filter((r) => r.path === '/discovered_device').length;
    await world.gladys.fake.scanRequest();
    const after = world.gladys.fake.requests.filter((r) => r.path === '/discovered_device').length;
    assert.equal(after, before + 1);
  } finally {
    await world.cleanup();
  }
});

test('feature names follow the configured language', async () => {
  const world = await createWorld({ config: { language: 'fr' } });
  try {
    const [device] = world.gladys.fake.discoveredDevices;
    assert.deepEqual(
      device.features.map((f) => f.name),
      [
        'Statut',
        'En ligne',
        'En jeu',
        'Jeu en cours',
        'Session de jeu',
        'Temps de jeu (2 semaines)',
        'Niveau Steam',
        'Dernière déconnexion',
      ],
    );
    await world.add(ID2);
    assert.equal(world.gladys.fake.lastState(world.feature(ID2, 'status')), 'Occupé');
    assert.equal(world.gladys.fake.lastState(world.feature(ID2, 'game')), 'Aucun');
  } finally {
    await world.cleanup();
  }
});

test('the "Check the accounts" action reports every entry in four languages', async () => {
  const world = await createWorld({
    config: { accounts: `testaccount1, ${ID2}, nobody, not/valid, 76561198000000099` },
  });
  try {
    const ack = await world.gladys.fake.action('check_accounts');
    assert.equal(ack.success, true);
    const { en, fr, de, es } = ack.data.message;
    assert.equal(
      en,
      [
        `testaccount1 (${ID1}): public profile`,
        `testaccount2 (${ID2}): private profile: status only, game hidden`,
        'nobody: not found on Steam',
        'not/valid: not a SteamID, a profile URL or a custom name',
        '76561198000000099: not found on Steam',
      ].join(' · '),
    );
    for (const text of [fr, de, es]) assert.equal(text.split(' · ').length, 5);
  } finally {
    await world.cleanup();
  }
});

test('the scene action reads an account from the last refresh', async () => {
  const world = await createWorld();
  try {
    for (let i = 0; i < 3; i += 1) await world.tick(1);
    const requests = world.steam.requests.length;
    const ack = await world.gladys.fake.sceneAction('get_account_status', {
      account: deviceOf(world.gladys, ID1),
    });
    assert.deepEqual(ack.data.outputs, {
      account_name: 'testaccount1',
      status: 'Online',
      online: true,
      in_game: true,
      game: 'The Witcher: Enhanced Edition',
      session_minutes: 3,
    });
    assert.equal(world.steam.requests.length, requests, 'no Steam request');
    const unknown = await world.gladys.fake.sceneAction('get_account_status', { account: 'x' });
    assert.equal(unknown.success, false);
  } finally {
    await world.cleanup();
  }
});
