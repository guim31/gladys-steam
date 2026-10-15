// -----------------------------------------------------------------------------
// One Gladys device per Steam account.
//
// External ids: `gladys.externalIds('account', <SteamID64>)`. The SteamID64 is
// the only stable identifier of an account (the persona name and the custom
// URL change at will). The feature keys below are forever too.
//
// The devices are published with `should_poll: true` and a poll frequency of
// the core's list, so that onPoll stays a fallback; the container refreshes
// them by itself (src/poller.js, Gladys#3198).
// -----------------------------------------------------------------------------

import { DEVICE_POLL_FREQUENCIES } from '@gladysassistant/integration-sdk';
import { NAMES, TEXT, pick, statusLabel } from './i18n.js';
import { isPlaying } from './steam/model.js';

export const DEVICE_TYPE = 'account';

/** Feature keys (part of the external ids: never rename one). */
export const FEATURE = {
  STATUS: 'status',
  ONLINE: 'online',
  IN_GAME: 'in_game',
  GAME: 'game',
  SESSION: 'session',
  PLAYTIME_2WEEKS: 'playtime_2weeks',
  LEVEL: 'level',
  LAST_LOGOFF: 'last_logoff',
};

const FEATURES = [
  { key: FEATURE.STATUS, category: 'text', type: 'text', min: 0, max: 0 },
  { key: FEATURE.ONLINE, category: 'input', type: 'binary', min: 0, max: 1 },
  { key: FEATURE.IN_GAME, category: 'input', type: 'binary', min: 0, max: 1 },
  { key: FEATURE.GAME, category: 'text', type: 'text', min: 0, max: 0 },
  // Display bounds only: a session longer than a day still publishes its value.
  {
    key: FEATURE.SESSION,
    category: 'duration',
    type: 'integer',
    unit: 'minutes',
    min: 0,
    max: 1440,
  },
  {
    key: FEATURE.PLAYTIME_2WEEKS,
    category: 'duration',
    type: 'decimal',
    unit: 'hours',
    min: 0,
    max: 336,
  },
  { key: FEATURE.LEVEL, category: 'counter-sensor', type: 'integer', min: 0, max: 5000 },
  { key: FEATURE.LAST_LOGOFF, category: 'text', type: 'text', min: 0, max: 0 },
];

/**
 * @param {object} gladys
 * @param {string} steamid
 */
export function accountIds(gladys, steamid) {
  return gladys.externalIds(DEVICE_TYPE, steamid);
}

/**
 * The SteamID64 of one of the integration's device external ids, or null.
 * @param {object} gladys
 * @param {string} externalId a device or feature external id
 */
export function steamidOf(gladys, externalId) {
  const prefix = gladys.externalId(`${DEVICE_TYPE}:`);
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  const steamid = externalId.slice(prefix.length).split(':')[0];
  return /^\d{17}$/.test(steamid) ? steamid : null;
}

/**
 * @param {object} gladys
 * @param {{ steamid: string, name: string }} account
 * @param {string} language
 */
export function buildDevice(gladys, account, language) {
  const ids = accountIds(gladys, account.steamid);
  const names = pick(NAMES, language);
  return {
    name: `Steam ${account.name}`,
    external_id: ids.device,
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    params: [{ name: 'steamid', value: account.steamid }],
    features: FEATURES.map(({ key, ...feature }) => ({
      name: names[key],
      external_id: ids.feature(key),
      read_only: true,
      has_feedback: false,
      ...feature,
    })),
  };
}

/**
 * The states of the fast-moving features of one account.
 * @param {object} gladys
 * @param {import('./steam/model.js').AccountSnapshot} snapshot
 * @param {number} sessionMinutes
 * @param {string} language
 */
export function summaryStates(gladys, snapshot, sessionMinutes, language) {
  const ids = accountIds(gladys, snapshot.steamid);
  const playing = isPlaying(snapshot);
  return [
    text(ids.feature(FEATURE.STATUS), statusLabel(snapshot.personastate, language)),
    number(ids.feature(FEATURE.ONLINE), snapshot.online ? 1 : 0),
    number(ids.feature(FEATURE.IN_GAME), playing ? 1 : 0),
    text(ids.feature(FEATURE.GAME), playing ? snapshot.gameName : pick(TEXT.noGame, language)),
    number(ids.feature(FEATURE.SESSION), playing ? sessionMinutes : 0),
    text(ids.feature(FEATURE.LAST_LOGOFF), formatDate(snapshot.lastLogoff, language)),
  ];
}

/**
 * The states of the slow features (level, playtime): null values are hidden
 * by the profile and published as nothing.
 * @param {object} gladys
 * @param {string} steamid
 * @param {{ level: number|null, playtimeHours: number|null }} details
 */
export function detailStates(gladys, steamid, { level, playtimeHours }) {
  const ids = accountIds(gladys, steamid);
  const states = [];
  if (level !== null) {
    states.push(number(ids.feature(FEATURE.LEVEL), level));
  }
  if (playtimeHours !== null) {
    states.push(number(ids.feature(FEATURE.PLAYTIME_2WEEKS), playtimeHours));
  }
  return states;
}

/**
 * A Unix time as a short local date, in the time zone of Gladys (TZ, set by
 * the supervisor).
 * @param {number|null} seconds
 * @param {string} language
 */
export function formatDate(seconds, language) {
  if (!seconds) {
    return pick(TEXT.unknown, language);
  }
  return new Intl.DateTimeFormat(language, { dateStyle: 'short', timeStyle: 'short' }).format(
    new Date(seconds * 1000),
  );
}

function text(id, value) {
  // A text state is never empty: Gladys ignores it.
  return { device_feature_external_id: id, text: String(value).slice(0, 255) || '-' };
}

function number(id, value) {
  return { device_feature_external_id: id, state: value };
}
