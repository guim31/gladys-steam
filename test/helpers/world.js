// -----------------------------------------------------------------------------
// The integration running against the SDK's fake Gladys and the fake Steam,
// with a hand-driven clock and a temporary /data. No timer runs: the tests
// call the refresh cycles themselves (except the timer test).
// -----------------------------------------------------------------------------

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { createApp } from '../../src/app.js';
import { API_KEY, ID1, ID2, ID3, createFakeSteam } from './fakeSteam.js';

export const T0 = Date.parse('2026-10-15T18:00:00Z');

export async function createWorld({
  config = {},
  devices = [],
  steam = createFakeSteam(),
  dataDir,
  timers = false,
  connect = true,
} = {}) {
  const dir = dataDir ?? (await mkdtemp(path.join(tmpdir(), 'gladys-steam-')));
  const clock = { now: T0 };
  const gladys = createFakeGladys({
    config: { api_key: API_KEY, accounts: `${ID1}, ${ID2}, ${ID3}`, language: 'en', ...config },
    devices,
  });
  const app = createApp({ gladys, fetch: steam.fetch, dataDir: dir, now: () => clock.now, timers });
  app.register();
  if (connect) {
    await gladys.connect();
  }
  return {
    gladys,
    steam,
    app,
    clock,
    dir,
    /** Move the clock forward and run one refresh. */
    async tick(minutes = 1) {
      clock.now += minutes * 60000;
      await app.cycle();
    },
    /** Add the discovered device of an account to Gladys, as the user would. */
    async add(steamid) {
      const device = gladys.fake.discoveredDevices.find((d) =>
        d.external_id.endsWith(`:${steamid}`),
      );
      await gladys.fake.deviceCreated(device);
      return device;
    },
    feature(steamid, key) {
      return gladys.externalIds('account', steamid).feature(key);
    },
    async cleanup() {
      await app.stop();
      if (!dataDir) {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}
