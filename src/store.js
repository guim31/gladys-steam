// -----------------------------------------------------------------------------
// What the integration remembers across restarts, in /data (the only
// writable volume of the container):
//   - `resolved`: custom profile names already resolved to a SteamID64, so a
//     restart while Steam is down still knows which device is which;
//   - `tracks`: the session of each account (src/tracker.js), so an update of
//     the integration in the middle of a game does not reset the "playing for
//     more than" counter.
// No secret is stored here: the API key stays in the Gladys configuration.
// A file that cannot be read or written only costs the memory, never a crash.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

const FILE_NAME = 'steam-state.json';

/**
 * @param {object} options
 * @param {string} [options.dir] defaults to $DATA_DIR or /data
 * @param {{ debug: Function, warn: Function }} options.logger
 */
export function createStore({ dir = process.env.DATA_DIR || '/data', logger }) {
  const file = path.join(dir, FILE_NAME);
  let data = { resolved: {}, tracks: {} };
  let saved = JSON.stringify(data);
  let warned = false;

  return {
    async load() {
      try {
        const parsed = JSON.parse(await readFile(file, 'utf8'));
        data = {
          resolved: isObject(parsed.resolved) ? parsed.resolved : {},
          tracks: isObject(parsed.tracks) ? parsed.tracks : {},
        };
        saved = JSON.stringify(data);
      } catch (err) {
        if (err.code !== 'ENOENT') {
          logger.warn(`State file unreadable, starting afresh (${err.message})`);
        }
      }
    },

    get data() {
      return data;
    },

    /** Write the file when something changed since the last write. */
    async save() {
      const text = JSON.stringify(data);
      if (text === saved) {
        return;
      }
      try {
        await mkdir(dir, { recursive: true });
        // Write then rename: a crash mid-write never leaves a truncated file.
        await writeFile(`${file}.tmp`, text);
        await rename(`${file}.tmp`, file);
        saved = text;
        warned = false;
      } catch (err) {
        if (!warned) {
          warned = true;
          logger.warn(
            `State file not written, sessions will restart with the container (${err.message})`,
          );
        } else {
          logger.debug(`State file still not written (${err.message})`);
        }
      }
    },
  };
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
