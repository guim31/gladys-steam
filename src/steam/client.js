// -----------------------------------------------------------------------------
// Steam Web API client (https://api.steampowered.com), read-only.
//
// Four methods, the ones the Home Assistant `steam_online` integration uses:
//   - ISteamUser/GetPlayerSummaries/v2   status, current game, last logoff
//                                         (up to 100 accounts per request);
//   - ISteamUser/ResolveVanityURL/v1     custom profile name -> SteamID64;
//   - IPlayerService/GetSteamLevel/v1    level;
//   - IPlayerService/GetRecentlyPlayedGames/v1   playtime of the last two weeks.
//
// The key travels in the query string, as Steam requires: an error message
// built here never contains the URL, and anything coming from the network
// layer is scrubbed of the key before it reaches a log.
// -----------------------------------------------------------------------------

const API_BASE = 'https://api.steampowered.com';
const DEFAULT_TIMEOUT_MS = 15000;

/** Accounts per GetPlayerSummaries request, a limit of the API. */
export const SUMMARIES_PER_REQUEST = 100;

export class SteamApiError extends Error {
  /**
   * @param {'auth' | 'rate_limit' | 'network' | 'http' | 'bad_response'} kind
   * @param {string} message
   * @param {number} [status]
   */
  constructor(kind, message, status) {
    super(message);
    this.name = 'SteamApiError';
    this.kind = kind;
    this.status = status;
  }
}

/**
 * @param {object} options
 * @param {string} options.apiKey
 * @param {typeof fetch} [options.fetch] injected by the tests
 * @param {number} [options.timeoutMs]
 */
export function createSteamClient({
  apiKey,
  fetch = globalThis.fetch,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}) {
  const scrub = (text) => (apiKey ? String(text).split(apiKey).join('***') : String(text));

  async function call(path, params) {
    const url = new URL(path, API_BASE);
    url.searchParams.set('key', apiKey);
    url.searchParams.set('format', 'json');
    for (const [name, value] of Object.entries(params)) {
      url.searchParams.set(name, String(value));
    }

    let response;
    try {
      response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (err) {
      const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err?.message);
      throw new SteamApiError('network', scrub(`Steam API unreachable (${reason})`));
    }

    // Steam answers a refused key with 401 or 403 and an HTML page.
    if (response.status === 401 || response.status === 403) {
      throw new SteamApiError(
        'auth',
        `Steam refused the API key (HTTP ${response.status})`,
        response.status,
      );
    }
    if (response.status === 429) {
      throw new SteamApiError('rate_limit', 'Steam API rate limit reached (HTTP 429)', 429);
    }
    if (!response.ok) {
      throw new SteamApiError('http', `Steam API error (HTTP ${response.status})`, response.status);
    }
    let body;
    try {
      body = await response.json();
    } catch {
      throw new SteamApiError('bad_response', 'Steam API answered something that is not JSON');
    }
    if (
      !body ||
      typeof body !== 'object' ||
      typeof body.response !== 'object' ||
      body.response === null
    ) {
      throw new SteamApiError('bad_response', 'Steam API answer without "response"');
    }
    return body.response;
  }

  return {
    /**
     * Summaries of up to 100 accounts. A SteamID unknown to Steam is simply
     * absent from the answer.
     * @param {string[]} steamids
     * @returns {Promise<object[]>}
     */
    async getPlayerSummaries(steamids) {
      const players = [];
      for (let i = 0; i < steamids.length; i += SUMMARIES_PER_REQUEST) {
        const chunk = steamids.slice(i, i + SUMMARIES_PER_REQUEST);
        const response = await call('/ISteamUser/GetPlayerSummaries/v2/', {
          steamids: chunk.join(','),
        });
        if (!Array.isArray(response.players)) {
          throw new SteamApiError('bad_response', 'GetPlayerSummaries answer without players');
        }
        players.push(...response.players);
      }
      return players;
    },

    /**
     * @param {string} vanity custom URL name
     * @returns {Promise<string|null>} the SteamID64, null when no profile has this name
     */
    async resolveVanityUrl(vanity) {
      const response = await call('/ISteamUser/ResolveVanityURL/v1/', { vanityurl: vanity });
      // success: 1 = found, 42 = no match.
      if (response.success === 1 && /^\d{17}$/.test(String(response.steamid))) {
        return String(response.steamid);
      }
      return null;
    },

    /**
     * @param {string} steamid
     * @returns {Promise<number|null>} null when the profile hides it
     */
    async getSteamLevel(steamid) {
      const response = await call('/IPlayerService/GetSteamLevel/v1/', { steamid });
      return Number.isInteger(response.player_level) ? response.player_level : null;
    },

    /**
     * @param {string} steamid
     * @returns {Promise<Array<{ appid: number, name?: string, playtime_2weeks?: number }>|null>}
     *   null when the game details are private (empty response)
     */
    async getRecentlyPlayedGames(steamid) {
      const response = await call('/IPlayerService/GetRecentlyPlayedGames/v1/', { steamid });
      if (response.total_count === undefined && response.games === undefined) {
        return null;
      }
      return Array.isArray(response.games) ? response.games : [];
    },
  };
}
