// -----------------------------------------------------------------------------
// What the integration keeps of a GetPlayerSummaries entry.
//
// The API splits a profile into public data (name, persona state, visibility,
// last logoff) and private data (current game, real name…): a private
// profile, or one whose game details are private, never shows a game, even
// while its owner plays. `public` says which one this is, so the widget and
// the "Check the accounts" action can tell the user.
// -----------------------------------------------------------------------------

/** communityvisibilitystate of a public profile (1 = private, 2 = friends only). */
const VISIBILITY_PUBLIC = 3;

/**
 * @typedef {object} AccountSnapshot
 * @property {string} steamid
 * @property {string} name persona name
 * @property {number} personastate 0 = offline, 1 = online, 2 = busy, 3 = away…
 * @property {boolean} online
 * @property {string|null} gameId
 * @property {string|null} gameName
 * @property {boolean} public
 * @property {number|null} lastLogoff Unix time, in seconds
 */

/**
 * @param {object} player one entry of GetPlayerSummaries `players`
 * @returns {AccountSnapshot}
 */
export function toSnapshot(player) {
  const personastate = Number.isInteger(player.personastate) ? player.personastate : 0;
  const gameId = player.gameid ? String(player.gameid) : null;
  const extra = typeof player.gameextrainfo === 'string' ? player.gameextrainfo.trim() : '';
  // A non-Steam game added to the library has a gameid and, usually, its
  // name in gameextrainfo; without a name, the app id is all there is.
  const gameName = extra !== '' ? extra : gameId ? `App ${gameId}` : null;
  return {
    steamid: String(player.steamid),
    name: String(player.personaname ?? player.steamid),
    personastate,
    online: personastate !== 0,
    gameId,
    gameName,
    public: player.communityvisibilitystate === VISIBILITY_PUBLIC,
    lastLogoff: Number.isInteger(player.lastlogoff) ? player.lastlogoff : null,
  };
}

/** @param {AccountSnapshot} snapshot */
export function isPlaying(snapshot) {
  return snapshot.gameName !== null;
}

/**
 * Sum of the playtime of the last two weeks, in hours (one decimal).
 * @param {Array<{ playtime_2weeks?: number }>} games
 */
export function recentPlaytimeHours(games) {
  const minutes = games.reduce((sum, game) => sum + (Number(game.playtime_2weeks) || 0), 0);
  return Math.round((minutes / 60) * 10) / 10;
}
