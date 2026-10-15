// -----------------------------------------------------------------------------
// The integration: wires the Steam client, the devices, the session tracker,
// the widget and the scene declarations to a Gladys client (the real one in
// index.js, the SDK's fake Gladys in the tests).
//
// Refresh: the container polls Steam by itself on a timer (the core does not
// reliably poll external devices, Gladys#3198); onPoll stays as a fallback and
// is skipped when the timer has just run. One GetPlayerSummaries request reads
// every account; the level and the playtime of the last two weeks, which move
// slowly, are read every 30 minutes and only for the devices added to Gladys.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import {
  isConfigured,
  normalizeConfig,
  refreshPeriodMs,
  splitAccounts,
  MAX_ACCOUNTS,
} from './config.js';
import { accountIds, buildDevice, detailStates, steamidOf, summaryStates } from './devices.js';
import { MESSAGES, REPORT, statusLabel } from './i18n.js';
import { createIssueLog } from './issues.js';
import { createStore } from './store.js';
import { createSteamClient, SteamApiError } from './steam/client.js';
import { parseAccount } from './steam/ids.js';
import { isPlaying, recentPlaytimeHours, toSnapshot } from './steam/model.js';
import { SESSION_GRACE_MS, emptyTrack, observe, sessionMinutes } from './tracker.js';
import { WIDGET, buildAccountsContent } from './widgets.js';

/** Scene trigger keys fired by the integration (declared in the manifest). */
export const SCENE_TRIGGER_KEYS = ['game_started', 'game_stopped', 'playing_for', 'went_online'];

/** Manifest action keys handled here. */
export const ACTION_KEYS = ['check_accounts'];

/** Scene action keys handled here. */
export const SCENE_ACTION_KEYS = ['get_account_status'];

/** The level and the recent playtime are read this often. */
export const DETAILS_PERIOD_MS = 30 * 60 * 1000;

/** An unchanged state is sent again this often, so Gladys keeps it recent. */
export const HEARTBEAT_MS = 6 * 60 * 60 * 1000;

/** After a 429, Steam is left alone this long. */
export const RATE_LIMIT_PAUSE_MS = 5 * 60 * 1000;

/**
 * @param {object} options
 * @param {object} options.gladys GladysIntegration or the SDK's fake Gladys
 * @param {typeof fetch} [options.fetch]
 * @param {string} [options.dataDir]
 * @param {() => number} [options.now]
 * @param {boolean} [options.timers] run the refresh timer (the tests drive cycles by hand)
 */
export function createApp({
  gladys,
  fetch = globalThis.fetch,
  dataDir,
  now = () => Date.now(),
  timers = true,
}) {
  const logger = createLogger({ name: 'steam' });
  const issues = createIssueLog(logger);
  const store = createStore({ dir: dataDir, logger });

  let config = normalizeConfig();
  let client = null;
  /** The resolved accounts, in the order of the configuration: `{ steamid, input }`. */
  let accounts = [];
  /** Last summary of each account, by SteamID64. */
  const snapshots = new Map();
  /** Level and recent playtime, by SteamID64: `{ level, playtimeHours, at }`. */
  const details = new Map();
  /** 'ok' | 'not_configured' | 'auth' | 'unreachable' | 'no_account' — what Gladys was last told. */
  let status = null;
  let steamDown = false;
  let lastCycleAt = null;
  let pausedUntil = 0;
  let inFlight = null;
  let timer = null;
  let stopped = false;
  let loaded = false;

  const created = () => new Set((gladys.devices ?? []).map((device) => device.external_id));
  const isCreated = (steamid, set = created()) => set.has(accountIds(gladys, steamid).device);

  // --- Connection status shown in the Configuration screen ------------------

  async function setStatus(next) {
    if (next === status) {
      return;
    }
    status = next;
    const message = {
      not_configured: MESSAGES.notConfigured,
      auth: MESSAGES.invalidKey,
      unreachable: MESSAGES.unreachable,
      no_account: MESSAGES.noAccountFound,
    }[next];
    await gladys.setConnectionStatus(next === 'ok', message).catch((err) => {
      logger.debug(`Connection status not sent (${err.message})`);
    });
  }

  // --- Accounts -------------------------------------------------------------

  /**
   * Turn the entries of the configuration into SteamID64s. A custom name is
   * resolved by Steam, falling back to the last known resolution while Steam
   * does not answer.
   * @returns {Promise<Array<{ input: string, steamid?: string, problem?: 'invalid'|'not_found'|'unresolved', error?: Error }>>}
   */
  async function resolveEntries() {
    const entries = splitAccounts(config.accounts);
    const results = [];
    for (const input of entries) {
      const parsed = parseAccount(input);
      if (parsed.kind === 'steamid') {
        results.push({ input, steamid: parsed.steamid });
      } else if (parsed.kind === 'invalid') {
        results.push({ input, problem: 'invalid' });
      } else {
        try {
          const steamid = await client.resolveVanityUrl(parsed.vanity);
          if (steamid) {
            store.data.resolved[parsed.vanity] = steamid;
            results.push({ input, steamid });
          } else {
            delete store.data.resolved[parsed.vanity];
            results.push({ input, problem: 'not_found' });
          }
        } catch (err) {
          const cached = store.data.resolved[parsed.vanity];
          results.push(
            cached ? { input, steamid: cached } : { input, problem: 'unresolved', error: err },
          );
          if (err.kind === 'auth') {
            // Every following call would be refused the same way.
            for (const rest of entries.slice(results.length)) {
              results.push({ input: rest, problem: 'unresolved', error: err });
            }
            break;
          }
        }
      }
    }
    return results;
  }

  async function loadAccounts() {
    const raw = String(config.accounts)
      .split(/[\s,;]+/)
      .filter(Boolean);
    if (new Set(raw).size > MAX_ACCOUNTS) {
      logger.warn(
        `More than ${MAX_ACCOUNTS} accounts entered: only the first ${MAX_ACCOUNTS} are followed`,
      );
    }
    const results = await resolveEntries();
    const seen = new Set();
    accounts = [];
    for (const result of results) {
      if (result.steamid && !seen.has(result.steamid)) {
        seen.add(result.steamid);
        accounts.push({ steamid: result.steamid, input: result.input });
      } else if (result.problem === 'invalid') {
        logger.warn(
          `Account "${result.input}" ignored: not a SteamID, a profile URL or a custom name`,
        );
      } else if (result.problem === 'not_found') {
        logger.warn(`Account "${result.input}" ignored: no Steam profile has this custom name`);
      } else if (result.problem === 'unresolved') {
        logger.warn(`Account "${result.input}" not resolved for now (${result.error.message})`);
      }
    }
    for (const steamid of [...snapshots.keys()]) {
      if (!seen.has(steamid)) {
        snapshots.delete(steamid);
        details.delete(steamid);
      }
    }
    return results;
  }

  // --- Devices --------------------------------------------------------------

  function discoveredDevices() {
    return accounts.map(({ steamid, input }) =>
      buildDevice(
        gladys,
        { steamid, name: snapshots.get(steamid)?.name ?? input },
        config.language,
      ),
    );
  }

  async function publishDevices() {
    await gladys.publishDiscoveredDevices(discoveredDevices());
  }

  // --- Refresh cycle --------------------------------------------------------

  /**
   * One refresh: summaries of every account, events, states of the added
   * devices, details when due. Errors are logged (once while they last),
   * never thrown.
   * @param {{ force?: boolean }} [options] force: read the details now too
   */
  function cycle(options = {}) {
    if (inFlight) {
      // A forced refresh waits for the one in progress, then runs its own.
      return options.force ? inFlight.then(() => cycle(options)) : inFlight;
    }
    inFlight = runCycle(options).finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  async function runCycle({ force = false } = {}) {
    if (gladys.connected === false || !client || accounts.length === 0) {
      logger.debug('Refresh skipped (not connected, not configured or no account)');
      return;
    }
    if (now() < pausedUntil) {
      logger.debug('Refresh skipped (Steam rate limit pause)');
      return;
    }
    lastCycleAt = now();

    let players;
    try {
      players = await client.getPlayerSummaries(accounts.map((account) => account.steamid));
    } catch (err) {
      await handleSteamError(err);
      return;
    }
    if (steamDown || status !== 'ok') {
      issues.ok('steam', 'Steam API answers again');
    }
    steamDown = false;
    await setStatus('ok');

    const at = now();
    const createdSet = created();
    const byId = new Map(players.map((player) => [String(player.steamid), player]));
    const states = [];
    const events = [];
    let changed = false;

    for (const { steamid, input } of accounts) {
      const player = byId.get(steamid);
      if (!player) {
        issues.fail(`missing:${steamid}`, `Account "${input}" (${steamid}) unknown to Steam`);
        continue;
      }
      issues.ok(`missing:${steamid}`, `Account "${input}" (${steamid}) found again`);
      const snapshot = toSnapshot(player);
      if (snapshot.public) {
        issues.ok(`private:${steamid}`, `Profile of ${snapshot.name} is public again`);
      } else {
        // Said once: the status works, the game never shows.
        issues.fail(
          `private:${steamid}`,
          `Profile of ${snapshot.name} is not public: its current game is hidden`,
        );
      }

      const previous = snapshots.get(steamid);
      if (!previous || summaryChanged(previous, snapshot)) {
        changed = true;
      }
      snapshots.set(steamid, snapshot);

      const { track, events: fired } = observe(store.data.tracks[steamid], snapshot, at, graceMs());
      store.data.tracks[steamid] = track;
      const ids = accountIds(gladys, steamid);
      for (const event of fired) {
        events.push({
          key: event.key,
          data: {
            account: ids.device,
            account_name: snapshot.name,
            ...(event.key === 'went_online'
              ? { status: statusLabel(snapshot.personastate, config.language) }
              : {}),
            ...event.data,
          },
        });
      }
      if (isCreated(steamid, createdSet)) {
        states.push(...summaryStates(gladys, snapshot, sessionMinutes(track, at), config.language));
      }
    }

    await publish(states);
    await refreshDetails({ force, createdSet });
    for (const event of events) {
      logger.debug(`Scene event ${event.key} for ${event.data.account_name}`);
      await gladys.publishSceneEvent(event.key, event.data).catch((err) => {
        issues.fail('scene-event', `Scene event not accepted by Gladys (${err.message})`);
      });
    }
    if (changed) {
      gladys.requestWidgetRefresh(WIDGET.ACCOUNTS);
    }
    await store.save();
    logger.debug(`Refresh done: ${accounts.length} account(s), ${events.length} event(s)`);
  }

  async function refreshDetails({ force, createdSet }) {
    const states = [];
    for (const { steamid } of accounts) {
      if (!isCreated(steamid, createdSet)) {
        continue;
      }
      const known = details.get(steamid);
      if (!force && known && now() - known.at < DETAILS_PERIOD_MS) {
        continue;
      }
      try {
        const level = await client.getSteamLevel(steamid);
        const games = await client.getRecentlyPlayedGames(steamid);
        const entry = {
          level,
          playtimeHours: games === null ? null : recentPlaytimeHours(games),
          at: now(),
        };
        details.set(steamid, entry);
        states.push(...detailStates(gladys, steamid, entry));
        issues.ok(`details:${steamid}`, `Level and playtime of ${steamid} read again`);
      } catch (err) {
        if (err instanceof SteamApiError && err.kind === 'rate_limit') {
          await handleSteamError(err);
          break;
        }
        issues.fail(
          `details:${steamid}`,
          `Level and playtime of ${steamid} not read (${err.message})`,
        );
      }
    }
    await publish(states);
  }

  async function publish(states) {
    if (states.length === 0) {
      return;
    }
    try {
      await gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      issues.ok('publish', 'States accepted by Gladys again');
    } catch (err) {
      issues.fail('publish', `States not accepted by Gladys (${err.message})`);
    }
  }

  async function handleSteamError(err) {
    steamDown = true;
    if (err instanceof SteamApiError && err.kind === 'auth') {
      issues.fail('steam', `Steam API: ${err.message}`);
      await setStatus('auth');
      return;
    }
    if (err instanceof SteamApiError && err.kind === 'rate_limit') {
      pausedUntil = now() + RATE_LIMIT_PAUSE_MS;
      issues.fail('steam', `Steam API: ${err.message}, pausing 5 minutes`);
      return;
    }
    issues.fail('steam', `Steam API: ${err.message}`);
    await setStatus('unreachable');
  }

  function graceMs() {
    return Math.max(SESSION_GRACE_MS, 2 * refreshPeriodMs(config));
  }

  // --- Timer ----------------------------------------------------------------

  function schedule() {
    clearTimeout(timer);
    timer = null;
    if (!timers || stopped) {
      return;
    }
    timer = setTimeout(async () => {
      timer = null;
      try {
        await cycle();
      } finally {
        schedule();
      }
    }, refreshPeriodMs(config));
    timer.unref?.();
  }

  // --- Start / restart ------------------------------------------------------

  /** (Re)start with the current config: resolve, read Steam, publish the devices. */
  async function start() {
    stopped = false;
    clearTimeout(timer);
    if (!loaded) {
      await store.load();
      loaded = true;
    }
    if (!isConfigured(config)) {
      client = null;
      accounts = [];
      logger.info('Not configured yet: waiting for the Steam API key and the accounts');
      await setStatus('not_configured');
      await gladys.publishDiscoveredDevices([]);
      gladys.requestWidgetRefresh(WIDGET.ACCOUNTS);
      return;
    }
    client = createSteamClient({ apiKey: config.api_key, fetch });
    status = null;
    const results = await loadAccounts();
    if (accounts.length === 0) {
      const authError = results.find((result) => result.error?.kind === 'auth');
      if (authError) {
        await handleSteamError(authError.error);
      } else if (results.some((result) => result.problem === 'unresolved')) {
        await handleSteamError(results.find((result) => result.error).error);
      } else {
        await setStatus('no_account');
      }
    } else {
      await cycle({ force: true });
      if (status === 'ok') {
        logger.info(`Steam API reachable: ${accounts.length} account(s) followed`);
      }
    }
    await publishDevices();
    gladys.requestWidgetRefresh(WIDGET.ACCOUNTS);
    schedule();
  }

  // --- Handlers -------------------------------------------------------------

  function accountFromField(externalId) {
    const steamid = steamidOf(gladys, externalId);
    return steamid ? accounts.find((account) => account.steamid === steamid) : undefined;
  }

  const handlers = {
    async connected() {
      try {
        config = normalizeConfig(await gladys.getConfig());
        await start();
      } catch (err) {
        logger.error(`Post-connection initialization failed: ${err.message}`);
        status = null;
        await gladys.setConnectionStatus(false, MESSAGES.initFailed).catch(() => {});
      }
    },

    async configUpdated(newConfig) {
      logger.info('Configuration updated');
      config = normalizeConfig(newConfig);
      details.clear();
      await start();
    },

    async scanRequest() {
      logger.info('Scan requested: publishing the Steam accounts');
      await publishDevices();
    },

    /** The core's onPoll, a fallback: skipped when the timer has just refreshed. */
    async poll(device) {
      if (lastCycleAt !== null && now() - lastCycleAt < refreshPeriodMs(config) * 0.9) {
        logger.debug(
          `onPoll skipped for ${device.external_id} (refreshed ${now() - lastCycleAt} ms ago)`,
        );
        return;
      }
      await cycle();
    },

    /**
     * A device just added (or updated) in Gladys: the SDK forgot its states,
     * everything is published again now (Gladys drops states sent before the
     * feature exists), and the widget may now list it.
     */
    async deviceCreated(device) {
      const steamid = steamidOf(gladys, device.external_id);
      if (!steamid) {
        return;
      }
      details.delete(steamid);
      gladys.forgetPublishedStates(device.external_id);
      await cycle({ force: true });
      gladys.requestWidgetRefresh(WIDGET.ACCOUNTS);
    },

    async checkAccounts() {
      logger.info('Action: check the accounts');
      if (!isConfigured(config)) {
        return MESSAGES.notConfigured;
      }
      const results = await resolveEntries();
      await store.save();
      const ids = results.filter((result) => result.steamid).map((result) => result.steamid);
      let players = [];
      if (ids.length > 0) {
        try {
          players = await client.getPlayerSummaries([...new Set(ids)]);
        } catch (err) {
          if (err.kind === 'auth') {
            return MESSAGES.invalidKey;
          }
          return MESSAGES.unreachable;
        }
      } else if (results.some((result) => result.error?.kind === 'auth')) {
        return MESSAGES.invalidKey;
      }
      const byId = new Map(players.map((player) => [String(player.steamid), toSnapshot(player)]));
      const message = {};
      for (const language of Object.keys(REPORT)) {
        const text = REPORT[language];
        const lines = results.map((result) => {
          if (result.problem === 'invalid') return text.invalid(result.input);
          if (result.problem === 'not_found') return text.notFound(result.input);
          if (result.problem === 'unresolved') return text.unresolved(result.input);
          const snapshot = byId.get(result.steamid);
          if (!snapshot) return text.notFound(result.input);
          return `${text.found(snapshot.name, snapshot.steamid)}: ${snapshot.public ? text.public : text.private}`;
        });
        message[language] = lines.length > 0 ? lines.join(' · ') : text.none;
      }
      return message;
    },

    /** Scene action: the current state of one account, for the next steps. */
    async getAccountStatus(fields) {
      const account = accountFromField(fields.account);
      if (!account) {
        throw new Error('Unknown Steam account: pick one of the integration devices');
      }
      const snapshot = snapshots.get(account.steamid);
      if (!snapshot) {
        throw new Error('No answer from Steam yet for this account');
      }
      const track = store.data.tracks[account.steamid] ?? emptyTrack();
      const playing = isPlaying(snapshot);
      return {
        account_name: snapshot.name,
        status: statusLabel(snapshot.personastate, config.language),
        online: snapshot.online,
        in_game: playing,
        game: playing ? snapshot.gameName : '',
        session_minutes: playing ? sessionMinutes(track, now()) : 0,
      };
    },

    async widgetGet({ language }) {
      const at = now();
      return buildAccountsContent({
        configured: isConfigured(config),
        accounts: accounts.map(({ steamid }) => ({
          steamid,
          snapshot: snapshots.get(steamid),
          sessionMinutes: sessionMinutes(store.data.tracks[steamid] ?? emptyTrack(), at),
        })),
        steamDown,
        language: ['en', 'fr', 'de', 'es'].includes(language) ? language : config.language,
        ttlSeconds: refreshPeriodMs(config) / 1000,
      });
    },
  };

  return {
    handlers,
    cycle,
    get config() {
      return config;
    },
    get accounts() {
      return accounts;
    },

    /** Register every handler on the Gladys client, before connect(). */
    register() {
      gladys.on('connected', handlers.connected);
      gladys.onConfigUpdated(handlers.configUpdated);
      gladys.onScanRequest(handlers.scanRequest);
      gladys.onPoll(handlers.poll);
      gladys.onDeviceCreated(handlers.deviceCreated);
      gladys.onDeviceUpdated(handlers.deviceCreated);
      gladys.onAction('check_accounts', handlers.checkAccounts);
      gladys.onSceneAction('get_account_status', handlers.getAccountStatus);
      gladys.onWidgetGet(WIDGET.ACCOUNTS, handlers.widgetGet);
    },

    async stop() {
      stopped = true;
      clearTimeout(timer);
      timer = null;
      await inFlight?.catch(() => {});
      await store.save();
    },
  };
}

function summaryChanged(a, b) {
  return (
    a.name !== b.name ||
    a.personastate !== b.personastate ||
    a.gameName !== b.gameName ||
    a.public !== b.public
  );
}
