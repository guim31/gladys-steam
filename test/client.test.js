import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSteamClient, SteamApiError } from '../src/steam/client.js';
import { API_KEY, ID1, ID2, createFakeSteam, fixture } from './helpers/fakeSteam.js';

function setup() {
  const steam = createFakeSteam();
  return { steam, client: createSteamClient({ apiKey: API_KEY, fetch: steam.fetch }) };
}

test('GetPlayerSummaries v2: one request for every account, the key in the query', async () => {
  const { steam, client } = setup();
  const players = await client.getPlayerSummaries([ID1, ID2]);
  assert.deepEqual(
    players.map((player) => player.personaname),
    ['testaccount1', 'testaccount2'],
  );
  assert.equal(steam.requests.length, 1);
  const [url] = steam.requests;
  assert.equal(url.origin, 'https://api.steampowered.com');
  assert.equal(url.pathname, '/ISteamUser/GetPlayerSummaries/v2/');
  assert.equal(url.searchParams.get('steamids'), `${ID1},${ID2}`);
});

test('more than 100 accounts are split in requests of 100', async () => {
  const { steam, client } = setup();
  const ids = Array.from({ length: 150 }, (_, i) => String(76561198000000100n + BigInt(i)));
  await client.getPlayerSummaries(ids);
  assert.deepEqual(
    steam.requests.map((url) => url.searchParams.get('steamids').split(',').length),
    [100, 50],
  );
});

test('ResolveVanityURL: found, or null on "No match"', async () => {
  const { client } = setup();
  assert.equal(await client.resolveVanityUrl('testaccount1'), ID1);
  assert.equal(await client.resolveVanityUrl('nobody'), null);
});

test('level and recent games, null when the profile hides them', async () => {
  const { steam, client } = setup();
  assert.equal(await client.getSteamLevel(ID1), 10);
  assert.equal((await client.getRecentlyPlayedGames(ID1)).length, 2);
  steam.level = fixture('GetSteamLevel-private');
  steam.recent = fixture('GetRecentlyPlayedGames-private');
  assert.equal(await client.getSteamLevel(ID1), null);
  assert.equal(await client.getRecentlyPlayedGames(ID1), null);
  steam.recent = { response: { total_count: 0 } };
  assert.deepEqual(await client.getRecentlyPlayedGames(ID1), []);
});

test('errors are typed, and never carry the key', async () => {
  const steam = createFakeSteam();
  const wrong = createSteamClient({ apiKey: 'WRONGKEY0123456789', fetch: steam.fetch });
  await assert.rejects(wrong.getPlayerSummaries([ID1]), (err) => {
    assert.ok(err instanceof SteamApiError);
    assert.equal(err.kind, 'auth');
    assert.ok(!err.message.includes('WRONGKEY'));
    return true;
  });

  const { client } = setup();
  for (const [failure, kind] of [
    [{ status: 429 }, 'rate_limit'],
    [{ status: 500 }, 'http'],
    [{ status: 401 }, 'auth'],
    [{ error: 'ENOTFOUND' }, 'network'],
  ]) {
    steam.failure = failure;
    const failing = createSteamClient({ apiKey: API_KEY, fetch: steam.fetch });
    await assert.rejects(failing.getPlayerSummaries([ID1]), (err) => {
      assert.equal(err.kind, kind);
      assert.ok(!err.message.includes(API_KEY));
      return true;
    });
  }
  assert.ok(client);
});

test('a network error quoting the URL is scrubbed of the key', async () => {
  const client = createSteamClient({
    apiKey: API_KEY,
    fetch: async (url) => {
      throw new TypeError(`request to ${url} failed`);
    },
  });
  await assert.rejects(client.getSteamLevel(ID1), (err) => {
    assert.equal(err.kind, 'network');
    assert.ok(!err.message.includes(API_KEY), err.message);
    return true;
  });
});

test('an answer that is not the expected JSON is a bad response', async () => {
  for (const response of [
    () => new Response('not json', { status: 200 }),
    () => Response.json({ error: 'x' }),
    () => Response.json({ response: { players: 'x' } }),
  ]) {
    const client = createSteamClient({ apiKey: API_KEY, fetch: async () => response() });
    await assert.rejects(client.getPlayerSummaries([ID1]), { kind: 'bad_response' });
  }
});
