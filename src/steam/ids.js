// -----------------------------------------------------------------------------
// Steam account identifiers, as users type them.
//
// The Web API only takes 64-bit SteamIDs (17 digits, 7656119…). Users rather
// know their profile URL, their custom URL name, or the older SteamID formats
// shown by game servers and third-party sites. Everything that can be turned
// into a SteamID64 without asking Steam is converted here; a custom name is
// returned as a "vanity" name, resolved through ResolveVanityURL.
//
// The SteamID64 is the platform id of the device (its external_id): never the
// custom name, which the user can change at any time on Steam.
// -----------------------------------------------------------------------------

// Base of the individual accounts in the public universe: SteamID64 =
// BASE + account id (the 32-bit number of the "[U:1:n]" form).
const INDIVIDUAL_BASE = 76561197960265728n;
const MAX_ACCOUNT_ID = 0xffffffffn;

/**
 * @typedef {{ kind: 'steamid', steamid: string, input: string }
 *   | { kind: 'vanity', vanity: string, input: string }
 *   | { kind: 'invalid', input: string }} ParsedAccount
 */

/**
 * @param {string} input one entry of the accounts field
 * @returns {ParsedAccount}
 */
export function parseAccount(input) {
  const raw = String(input ?? '').trim();
  let text = raw;

  // A profile URL: steamcommunity.com/profiles/<SteamID64> or /id/<custom name>.
  const url = text.match(
    /^(?:https?:\/\/)?(?:www\.)?steamcommunity\.com\/(profiles|id)\/([^/?#]+)/i,
  );
  if (url) {
    if (url[1].toLowerCase() === 'id') {
      return vanityOrInvalid(decodeURIComponentSafe(url[2]), raw);
    }
    text = url[2];
  }

  if (/^\d{17}$/.test(text)) {
    return isIndividual(BigInt(text))
      ? { kind: 'steamid', steamid: text, input: raw }
      : invalid(raw);
  }

  // STEAM_X:Y:Z (legacy): account id = Z * 2 + Y.
  const legacy = text.match(/^STEAM_[0-5]:([01]):(\d{1,10})$/i);
  if (legacy) {
    return fromAccountId(BigInt(legacy[2]) * 2n + BigInt(legacy[1]), raw);
  }

  // [U:1:n] (SteamID3).
  const steam3 = text.match(/^\[?U:1:(\d{1,10})\]?$/i);
  if (steam3) {
    return fromAccountId(BigInt(steam3[1]), raw);
  }

  if (url) {
    // steamcommunity.com/profiles/<something that is not an id>.
    return invalid(raw);
  }
  return vanityOrInvalid(text, raw);
}

/** @param {bigint} steamid */
function isIndividual(steamid) {
  return steamid > INDIVIDUAL_BASE && steamid <= INDIVIDUAL_BASE + MAX_ACCOUNT_ID;
}

function fromAccountId(accountId, raw) {
  if (accountId < 1n || accountId > MAX_ACCOUNT_ID) {
    return invalid(raw);
  }
  return { kind: 'steamid', steamid: String(INDIVIDUAL_BASE + accountId), input: raw };
}

// Custom URL names are 2 to 32 letters, digits, underscores or hyphens.
function vanityOrInvalid(text, raw) {
  return /^[A-Za-z0-9_-]{2,32}$/.test(text)
    ? { kind: 'vanity', vanity: text.toLowerCase(), input: raw }
    : invalid(raw);
}

function invalid(raw) {
  return { kind: 'invalid', input: raw };
}

function decodeURIComponentSafe(text) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}
