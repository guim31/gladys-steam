import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  isConfigured,
  normalizeConfig,
  refreshPeriodMs,
  splitAccounts,
} from '../src/config.js';

test('defaults, and values cleaned of what a form leaves', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(
    normalizeConfig({ api_key: '  KEY\n', accounts: 'a', refresh_interval: 45, language: 'it' }),
    { api_key: 'KEY', accounts: 'a', refresh_interval: '60', language: 'fr' },
  );
  assert.equal(refreshPeriodMs(normalizeConfig({ refresh_interval: 300 })), 300000);
});

test('accounts are split on commas, semicolons, spaces and lines, without duplicates, 20 at most', () => {
  assert.deepEqual(splitAccounts(' a, b;c\nd  a ,, '), ['a', 'b', 'c', 'd']);
  assert.equal(splitAccounts(Array.from({ length: 30 }, (_, i) => `n${i}`).join(',')).length, 20);
});

test('configured means a key and at least one account', () => {
  assert.equal(isConfigured(normalizeConfig({ api_key: 'k' })), false);
  assert.equal(isConfigured(normalizeConfig({ accounts: 'a' })), false);
  assert.equal(isConfigured(normalizeConfig({ api_key: 'k', accounts: ' , a' })), true);
});
