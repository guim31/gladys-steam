// -----------------------------------------------------------------------------
// Integration configuration.
//
// Filled in by the user in Gladys from the `config_schema` of the manifest,
// fetched by the SDK (`gladys.getConfig()`) and pushed again on every change
// (`gladys.onConfigUpdated()`). This module provides the defaults and
// normalizes the received object, so the rest of the code never deals with
// `undefined`, strings typed with spaces or out-of-range values.
// -----------------------------------------------------------------------------

/** The languages of the Gladys interface, for the texts the container produces. */
export const LANGUAGES = ['en', 'fr', 'de', 'es'];

/** Refresh intervals offered in the configuration, in seconds (select values are strings). */
export const REFRESH_INTERVALS = ['30', '60', '120', '300'];

/** More accounts than this are ignored (the widget shows ten, one request carries them all). */
export const MAX_ACCOUNTS = 20;

// Defaults: they MUST stay consistent with the `default` values declared in the
// `config_schema` of the manifest (test/manifest.test.js checks it).
export const DEFAULT_CONFIG = {
  api_key: '',
  accounts: '',
  refresh_interval: '60',
  language: 'fr',
};

/**
 * Merge the user config with the defaults and clean every value.
 * @param {Record<string, unknown>} [raw] config returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const language = String(raw.language ?? DEFAULT_CONFIG.language);
  const interval = String(raw.refresh_interval ?? DEFAULT_CONFIG.refresh_interval);
  return {
    // A key pasted from the Steam page often carries a space or a line break.
    api_key: String(raw.api_key ?? '').trim(),
    accounts: String(raw.accounts ?? ''),
    refresh_interval: REFRESH_INTERVALS.includes(interval)
      ? interval
      : DEFAULT_CONFIG.refresh_interval,
    language: LANGUAGES.includes(language) ? language : DEFAULT_CONFIG.language,
  };
}

/** @param {{ refresh_interval: string }} config */
export function refreshPeriodMs(config) {
  return Number(config.refresh_interval) * 1000;
}

/** True when the integration has what it needs to call Steam. */
export function isConfigured(config) {
  return config.api_key !== '' && splitAccounts(config.accounts).length > 0;
}

/**
 * The account entries typed by the user: separated by commas, semicolons,
 * spaces or line breaks, duplicates removed, at most MAX_ACCOUNTS.
 * @param {string} text
 * @returns {string[]}
 */
export function splitAccounts(text) {
  const entries = String(text ?? '')
    .split(/[\s,;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
  return [...new Set(entries)].slice(0, MAX_ACCOUNTS);
}
