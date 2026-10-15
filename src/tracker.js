// -----------------------------------------------------------------------------
// Gaming sessions and scene events, from one observation to the next.
//
// Pure functions: given what was known of an account (persisted in /data so a
// container restart does not reset a session in progress) and a new
// observation, they return the new knowledge and the events to fire.
//
// - game_started / game_stopped: one event per change of game, compared with
//   the previous observation. The very first observation of an account sets a
//   baseline and fires nothing (it says nothing about what just happened).
// - went_online: offline -> any other persona state.
// - playing_for: a SESSION is continuous play, whatever the game: switching
//   games keeps it, and so does a break shorter than the grace period (a
//   crash, a restart of the game), or an outage of Steam while in game. Each threshold fires once per session,
//   the core's filters doing equality only (the user picks the threshold).
// -----------------------------------------------------------------------------

import { isPlaying } from './steam/model.js';

/** The thresholds offered by the "playing for more than" trigger, in minutes. */
export const THRESHOLDS = [15, 30, 45, 60, 90, 120, 180, 240];

/** A break shorter than this keeps the session going (at least two refresh periods). */
export const SESSION_GRACE_MS = 10 * 60 * 1000;

/**
 * Seen in game, then not seen at all for longer than this (Steam down, the
 * container stopped): the session is not assumed to have lasted.
 */
export const SESSION_BLIND_MS = 60 * 60 * 1000;

/**
 * @typedef {object} AccountTrack
 * @property {number|null} personastate last persona state seen
 * @property {{ id: string|null, name: string }|null} game game seen last time
 * @property {number|null} gameSince when that game was first seen (ms)
 * @property {number|null} sessionStart start of the current session (ms)
 * @property {number|null} lastPlayingAt last observation in game (ms)
 * @property {number[]} fired thresholds already fired in the session
 */

/** @returns {AccountTrack} */
export function emptyTrack() {
  return {
    personastate: null,
    game: null,
    gameSince: null,
    sessionStart: null,
    lastPlayingAt: null,
    fired: [],
  };
}

/**
 * Minutes of the current session at `now`, 0 when none.
 * @param {AccountTrack} track
 * @param {number} now
 */
export function sessionMinutes(track, now) {
  if (track.sessionStart === null) {
    return 0;
  }
  return Math.max(0, Math.floor((now - track.sessionStart) / 60000));
}

/**
 * @param {AccountTrack|undefined} previous
 * @param {import('./steam/model.js').AccountSnapshot} snapshot
 * @param {number} now ms
 * @param {number} [graceMs]
 * @returns {{ track: AccountTrack, events: Array<{ key: string, data: object }> }}
 */
export function observe(previous, snapshot, now, graceMs = SESSION_GRACE_MS) {
  const known = previous !== undefined && previous.personastate !== null;
  const prev = previous ?? emptyTrack();
  const track = { ...prev, fired: [...prev.fired] };
  const events = [];
  const playing = isPlaying(snapshot);
  const game = playing ? { id: snapshot.gameId, name: snapshot.gameName } : null;
  const sameGame = sameAs(prev.game, game);

  // Session first. Seen out of game, a break longer than the grace period
  // ends it. Seen in game both times, the player most likely kept playing
  // while Steam did not answer: the session goes on, unless nothing was seen
  // for an hour.
  const gap = track.lastPlayingAt === null ? Infinity : now - track.lastPlayingAt;
  if (track.sessionStart !== null && gap > (prev.game ? SESSION_BLIND_MS : graceMs)) {
    track.sessionStart = null;
    track.fired = [];
  }

  if (known && prev.personastate === 0 && snapshot.personastate !== 0) {
    events.push({ key: 'went_online', data: {} });
  }

  if (known && prev.game && !sameGame) {
    events.push({
      key: 'game_stopped',
      data: {
        game: prev.game.name,
        game_id: prev.game.id,
        minutes:
          prev.gameSince === null ? 0 : Math.max(0, Math.round((now - prev.gameSince) / 60000)),
      },
    });
  }
  if (known && game && !sameGame) {
    events.push({ key: 'game_started', data: { game: game.name, game_id: game.id } });
  }

  if (!sameGame) {
    track.game = game;
    track.gameSince = game ? now : null;
  }

  if (playing) {
    if (track.sessionStart === null) {
      track.sessionStart = now;
      track.fired = [];
    }
    track.lastPlayingAt = now;
    const minutes = sessionMinutes(track, now);
    for (const threshold of THRESHOLDS) {
      if (minutes >= threshold && !track.fired.includes(threshold)) {
        track.fired.push(threshold);
        events.push({
          key: 'playing_for',
          data: { minutes: threshold, session_minutes: minutes, game: game.name, game_id: game.id },
        });
      }
    }
  }

  track.personastate = snapshot.personastate;
  return { track, events };
}

function sameAs(a, b) {
  if (a === null || b === null) {
    return a === b;
  }
  // The app id identifies the game; a non-Steam game may only have a name.
  return a.id !== null && b.id !== null ? a.id === b.id : a.name === b.name;
}
