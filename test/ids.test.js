import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAccount } from '../src/steam/ids.js';

const ID = '76561198000000001';

test('a SteamID64 is taken as is', () => {
  assert.deepEqual(parseAccount(` ${ID} `), { kind: 'steamid', steamid: ID, input: ID });
});

test('profile URLs give the SteamID64 or the custom name', () => {
  assert.equal(parseAccount(`https://steamcommunity.com/profiles/${ID}/`).steamid, ID);
  assert.equal(parseAccount(`steamcommunity.com/profiles/${ID}`).steamid, ID);
  assert.deepEqual(parseAccount('https://steamcommunity.com/id/TestAccount1/?l=french'), {
    kind: 'vanity',
    vanity: 'testaccount1',
    input: 'https://steamcommunity.com/id/TestAccount1/?l=french',
  });
});

test('the older SteamID formats are converted without asking Steam', () => {
  // 76561198000000001 = base 76561197960265728 + account id 39734273.
  assert.equal(parseAccount('[U:1:39734273]').steamid, ID);
  assert.equal(parseAccount('U:1:39734273').steamid, ID);
  // STEAM_0:Y:Z, account id = Z * 2 + Y = 19867136 * 2 + 1.
  assert.equal(parseAccount('STEAM_0:1:19867136').steamid, ID);
  assert.equal(parseAccount('STEAM_1:1:19867136').steamid, ID);
});

test('a bare name is a custom URL name, resolved later', () => {
  assert.deepEqual(parseAccount('my_custom-name'), {
    kind: 'vanity',
    vanity: 'my_custom-name',
    input: 'my_custom-name',
  });
});

test('what cannot be an account is refused', () => {
  for (const input of [
    '12345678901234567', // 17 digits, not an individual account
    'https://steamcommunity.com/profiles/not-an-id',
    'https://steamcommunity.com/id/a',
    'a',
    'name with é',
    '[U:1:0]',
    'x'.repeat(33),
  ]) {
    assert.equal(parseAccount(input).kind, 'invalid', input);
  }
});
