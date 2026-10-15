// -----------------------------------------------------------------------------
// Quiet logs: a normal refresh writes nothing at the info level, a failure
// that repeats writes one line when it starts and one when it ends, and the
// API key never appears, whatever happens.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createWorld } from './helpers/world.js';
import { API_KEY, ID1 } from './helpers/fakeSteam.js';

/** Capture what the SDK logger writes (console.log for debug/info, console.error for warn/error). */
function captureLogs(t, level = 'debug') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  t.after(() => {
    if (previous === undefined) delete process.env.LOG_LEVEL;
    else process.env.LOG_LEVEL = previous;
  });
  const lines = [];
  const record = (...args) => lines.push(args.map(String).join(' '));
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  return {
    lines,
    at: (lvl) => lines.filter((line) => line.includes(`[${lvl.toUpperCase()}]`)),
    /** The lines at info and above, in order. */
    loud: () => lines.filter((line) => !line.includes('[DEBUG]')),
    clear: () => lines.splice(0),
  };
}

test('a normal refresh cycle writes nothing at the info level', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  try {
    await world.add(ID1);
    logs.clear();
    world.steam.stop(ID1);
    for (let i = 0; i < 40; i += 1) await world.tick(1);
    world.steam.play(ID1, '620', 'Portal 2');
    for (let i = 0; i < 40; i += 1) await world.tick(1);
    await world.gladys.fake.widgetGet('accounts', { language: 'fr' });
    await world.gladys.fake.poll({ external_id: world.gladys.externalIds('account', ID1).device });
    assert.deepEqual(logs.loud(), []);
    assert.ok(logs.at('debug').length > 0, 'the cycles are visible with LOG_LEVEL=debug');
  } finally {
    await world.cleanup();
  }
});

test('a repeated failure writes one line when it starts and one when it ends', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld();
  try {
    logs.clear();
    world.steam.failure = { error: 'ECONNRESET' };
    for (let i = 0; i < 10; i += 1) await world.tick(1);
    world.steam.failure = null;
    for (let i = 0; i < 3; i += 1) await world.tick(1);
    const lines = logs.loud();
    assert.equal(lines.length, 2, lines.join('\n'));
    assert.match(lines[0], /\[WARN\].*unreachable/);
    assert.match(lines[1], /\[INFO\].*answers again/);
  } finally {
    await world.cleanup();
  }
});

test('the API key never reaches the logs, even at the debug level and on errors', async (t) => {
  const logs = captureLogs(t);
  const world = await createWorld({ config: { accounts: `testaccount1, nobody, ${ID1}` } });
  try {
    await world.add(ID1);
    await world.gladys.fake.action('check_accounts');
    for (const failure of [
      { status: 403 },
      { status: 429 },
      { status: 500 },
      { error: 'ETIMEDOUT' },
    ]) {
      world.steam.failure = failure;
      await world.tick(6);
    }
    world.steam.failure = null;
    await world.gladys.fake.configUpdated({
      ...world.gladys.fake.config,
      api_key: 'WRONGKEY0123456789',
    });
    await world.tick(1);
    assert.ok(logs.lines.length > 0);
    for (const line of logs.lines) {
      assert.ok(!line.includes(API_KEY), `key in: ${line}`);
      assert.ok(!line.includes('WRONGKEY0123456789'), `key in: ${line}`);
      assert.ok(!line.includes('key='), `URL with key in: ${line}`);
    }
  } finally {
    await world.cleanup();
  }
});
