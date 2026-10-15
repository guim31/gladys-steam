#!/usr/bin/env node
// -----------------------------------------------------------------------------
// Probe of the real Steam Web API, read-only, through the integration's own
// client (src/steam/client.js). For a machine that has the network:
//
//   node scripts/probe.mjs
//       A fake key: every method must be refused (auth) — proves the URLs,
//       the HTTP handling and that the key never leaks into an error.
//
//   STEAM_API_KEY=... STEAM_ACCOUNTS="7656119..., custom_name" node scripts/probe.mjs
//       A real key: resolves the accounts and prints, per account, only the
//       shape of the answer (visibility, status number, in game or not,
//       level present or hidden). No name, no SteamID, no key is printed.
// -----------------------------------------------------------------------------

import { createSteamClient } from '../src/steam/client.js';
import { parseAccount } from '../src/steam/ids.js';
import { splitAccounts } from '../src/config.js';
import { toSnapshot, isPlaying } from '../src/steam/model.js';

const FAKE_KEY = '0123456789ABCDEF0123456789ABCDEF';
// A syntactically valid SteamID64 nobody owns in practice.
const SAMPLE_ID = '76561198000000001';

const realKey = process.env.STEAM_API_KEY?.trim();
const key = realKey || FAKE_KEY;
const client = createSteamClient({ apiKey: key });

function report(label, outcome) {
  console.log(`${label.padEnd(28)} ${outcome}`);
}

async function attempt(label, run, describe = () => 'ok') {
  try {
    report(label, describe(await run()));
    return true;
  } catch (err) {
    const leak = err.message.includes(key) ? ' (KEY LEAKED IN MESSAGE!)' : '';
    report(label, `${err.kind ?? 'error'}: ${err.message}${leak}`);
    return false;
  }
}

if (!realKey) {
  console.log('Fake key: every call below must end with "auth".\n');
  await attempt('GetPlayerSummaries', () => client.getPlayerSummaries([SAMPLE_ID]));
  await attempt('ResolveVanityURL', () => client.resolveVanityUrl('gladys_probe'));
  await attempt('GetSteamLevel', () => client.getSteamLevel(SAMPLE_ID));
  await attempt('GetRecentlyPlayedGames', () => client.getRecentlyPlayedGames(SAMPLE_ID));
  process.exit(0);
}

const entries = splitAccounts(process.env.STEAM_ACCOUNTS ?? '');
const ids = [];
for (const [index, input] of entries.entries()) {
  const parsed = parseAccount(input);
  const label = `account #${index + 1} (${parsed.kind})`;
  if (parsed.kind === 'steamid') {
    ids.push(parsed.steamid);
    report(label, 'SteamID64 given');
  } else if (parsed.kind === 'vanity') {
    await attempt(
      label,
      () => client.resolveVanityUrl(parsed.vanity),
      (id) => {
        if (id) ids.push(id);
        return id ? 'resolved' : 'no match';
      },
    );
  } else {
    report(label, 'invalid entry');
  }
}

const ok = await attempt(
  'GetPlayerSummaries',
  () => client.getPlayerSummaries(ids),
  (players) => {
    for (const [index, player] of players.entries()) {
      const snapshot = toSnapshot(player);
      report(
        `  player #${index + 1}`,
        `public=${snapshot.public} personastate=${snapshot.personastate} in_game=${isPlaying(snapshot)} lastlogoff=${snapshot.lastLogoff !== null}`,
      );
    }
    return `${players.length}/${ids.length} account(s) answered`;
  },
);
if (ok) {
  for (const [index, id] of ids.entries()) {
    await attempt(
      `  level #${index + 1}`,
      () => client.getSteamLevel(id),
      (level) => (level === null ? 'hidden' : 'present'),
    );
    await attempt(
      `  recent games #${index + 1}`,
      () => client.getRecentlyPlayedGames(id),
      (games) => (games === null ? 'hidden' : `${games.length} game(s)`),
    );
  }
}
