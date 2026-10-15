// -----------------------------------------------------------------------------
// The "Steam accounts" dashboard widget: who is online, who plays what and
// for how long. Pure builder: the data comes from the last refresh (no Steam
// request per dashboard), the content is localized from the language of the
// dashboard request.
//
// Core budget: 8 components, 2 texts at most, 1 status list of 10 rows.
// Colors carry the meaning, never the `primary` style (invisible in dark mode).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { TEXT, pick, statusLabel } from './i18n.js';
import { isPlaying } from './steam/model.js';

export const WIDGET = { ACCOUNTS: 'accounts' };

const MAX_ROWS = 10;
const MAX_VALUE = 40;

/**
 * @param {object} input
 * @param {boolean} input.configured
 * @param {Array<{ steamid: string, snapshot?: object, sessionMinutes: number }>} input.accounts
 *   in the order of the configuration
 * @param {boolean} input.steamDown the last refresh failed
 * @param {string} input.language
 * @param {number} input.ttlSeconds
 */
export function buildAccountsContent({ configured, accounts, steamDown, language, ttlSeconds }) {
  const ttl = Math.min(3600, Math.max(10, Math.round(ttlSeconds)));
  if (!configured) {
    return { ttl_seconds: ttl, components: [body(pick(TEXT.notConfigured, language))] };
  }
  const seen = accounts.filter((account) => account.snapshot);
  if (seen.length === 0) {
    const text = steamDown ? TEXT.steamUnreachable : TEXT.waiting;
    return { ttl_seconds: ttl, components: [body(pick(text, language))] };
  }

  const playing = seen.filter((account) => isPlaying(account.snapshot)).length;
  const online = seen.filter((account) => account.snapshot.online).length;
  const components = [
    {
      type: 'value',
      label: pick(TEXT.inGame, language),
      value: playing,
      icon: 'play',
      color: playing > 0 ? WIDGET_COLORS.SUCCESS : WIDGET_COLORS.NEUTRAL,
    },
    {
      type: 'value',
      label: pick(TEXT.online, language),
      value: `${online}/${seen.length}`,
      icon: 'users',
    },
    { type: 'status', items: seen.slice(0, MAX_ROWS).map((account) => row(account, language)) },
  ];

  const notes = [];
  if (steamDown) {
    notes.push(pick(TEXT.steamUnreachable, language));
  }
  const hidden = seen
    .filter((account) => !account.snapshot.public)
    .map((account) => account.snapshot.name);
  if (hidden.length > 0) {
    notes.push(`${pick(TEXT.privateProfiles, language)} ${hidden.join(', ')}`);
  }
  if (seen.length > MAX_ROWS) {
    notes.push(`+${seen.length - MAX_ROWS} ${pick(TEXT.moreAccounts, language)}`);
  }
  if (notes.length > 0) {
    components.push({ type: 'text', variant: 'caption', text: truncate(notes.join(' · '), 80) });
  }
  return { ttl_seconds: ttl, components };
}

function row({ snapshot, sessionMinutes }, language) {
  const label = truncate(snapshot.name, 40);
  if (isPlaying(snapshot)) {
    const duration = sessionMinutes > 0 ? ` · ${formatMinutes(sessionMinutes, language)}` : '';
    return {
      label,
      value: truncateKeeping(snapshot.gameName, duration, MAX_VALUE),
      icon: 'play',
      color: WIDGET_COLORS.SUCCESS,
    };
  }
  const status = statusLabel(snapshot.personastate, language);
  if (snapshot.personastate === 0) {
    return { label, value: status, icon: 'user-x', color: WIDGET_COLORS.NEUTRAL };
  }
  // Busy, away, snooze: online but not available.
  const available = snapshot.personastate === 1 || snapshot.personastate >= 5;
  return {
    label,
    value: status,
    icon: available ? 'user-check' : 'moon',
    color: available ? WIDGET_COLORS.INFO : WIDGET_COLORS.WARNING,
  };
}

/** "45 min", "2 h 05" */
export function formatMinutes(minutes, language) {
  if (minutes < 60) {
    return `${minutes} ${pick(TEXT.minutes, language)}`;
  }
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`;
}

function body(text) {
  return { type: 'text', variant: 'body', text };
}

function truncate(text, max) {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}

// Cut the game name, never the duration after it.
function truncateKeeping(head, tail, max) {
  return `${truncate(head, Math.max(1, max - tail.length))}${tail}`;
}
