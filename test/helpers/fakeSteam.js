// -----------------------------------------------------------------------------
// A fake Steam Web API, as an injected `fetch`: answers from the fixtures of
// test/fixtures/steam (real answer shapes), records every request, and lets a
// test change what Steam says (a player starts a game, the key is refused,
// Steam is down). No network is ever touched.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';

export const API_KEY = 'ABCDEF0123456789ABCDEF0123456789';
export const ID1 = '76561198000000001';
export const ID2 = '76561198000000002';
export const ID3 = '76561198000000003';

export function fixture(name) {
  return JSON.parse(
    readFileSync(new URL(`../fixtures/steam/${name}.json`, import.meta.url), 'utf8'),
  );
}

export function createFakeSteam() {
  const players = new Map(
    fixture('GetPlayerSummaries').response.players.map((player) => [player.steamid, player]),
  );
  const steam = {
    players,
    vanity: new Map([['testaccount1', ID1]]),
    level: fixture('GetSteamLevel'),
    recent: fixture('GetRecentlyPlayedGames'),
    /** null, or a forced answer: { status } or { error } (network failure). */
    failure: null,
    requests: [],

    /** Change one player, as Steam would report it. */
    set(steamid, changes) {
      const player = { ...players.get(steamid), ...changes };
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined) delete player[key];
      }
      players.set(steamid, player);
    },
    play(steamid, gameid, name) {
      steam.set(steamid, { personastate: 1, gameid, gameextrainfo: name });
    },
    stop(steamid) {
      steam.set(steamid, { gameid: undefined, gameextrainfo: undefined });
    },

    calls(method) {
      return steam.requests.filter((url) => url.pathname.includes(`/${method}/`));
    },

    async fetch(input) {
      const url = new URL(input);
      steam.requests.push(url);
      if (steam.failure?.error) {
        throw Object.assign(new TypeError('fetch failed'), {
          cause: { code: steam.failure.error },
        });
      }
      if (steam.failure?.status) {
        return new Response('<html><body>Forbidden</body></html>', {
          status: steam.failure.status,
        });
      }
      if (url.searchParams.get('key') !== API_KEY) {
        return new Response('<html><body><h1>Forbidden</h1></body></html>', { status: 403 });
      }
      const json = (body) => Response.json(body);
      const method = url.pathname.split('/')[2];
      switch (method) {
        case 'GetPlayerSummaries': {
          const ids = url.searchParams.get('steamids').split(',');
          return json({
            response: { players: ids.filter((id) => players.has(id)).map((id) => players.get(id)) },
          });
        }
        case 'ResolveVanityURL': {
          const steamid = steam.vanity.get(url.searchParams.get('vanityurl'));
          return json(
            steamid ? { response: { steamid, success: 1 } } : fixture('ResolveVanityURL-nomatch'),
          );
        }
        case 'GetSteamLevel':
          return json(steam.level);
        case 'GetRecentlyPlayedGames':
          return json(steam.recent);
        default:
          return new Response('Not Found', { status: 404 });
      }
    },
  };
  steam.fetch = steam.fetch.bind(steam);
  return steam;
}
