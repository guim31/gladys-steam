import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { buildAccountsContent, formatMinutes } from '../src/widgets.js';
import { createWorld } from './helpers/world.js';
import { ID1, ID2 } from './helpers/fakeSteam.js';

const LANGS = ['en', 'fr', 'de', 'es'];

function account(i, changes = {}) {
  return {
    steamid: `7656119800000${String(i).padStart(4, '0')}`,
    sessionMinutes: 0,
    snapshot: {
      steamid: `7656119800000${String(i).padStart(4, '0')}`,
      name: `player${i}`,
      personastate: 1,
      online: true,
      gameId: null,
      gameName: null,
      public: true,
      lastLogoff: null,
      ...changes,
    },
  };
}

test('the widget content fits the core vocabulary and budget, in every case and language', () => {
  const cases = [
    { configured: false, accounts: [] },
    { configured: true, accounts: [{ steamid: '1', sessionMinutes: 0 }] },
    { configured: true, accounts: [{ steamid: '1', sessionMinutes: 0 }], steamDown: true },
    {
      configured: true,
      accounts: [
        account(1, { gameId: '1', gameName: 'A game with a very very very long name, really' }),
        account(2, { personastate: 3 }),
        account(3, { personastate: 0, online: false, public: false }),
      ],
    },
    {
      configured: true,
      steamDown: true,
      accounts: Array.from({ length: 14 }, (_, i) =>
        account(i, { public: i % 2 === 0, personastate: i % 7 }),
      ),
    },
  ];
  for (const input of cases) {
    for (const language of LANGS) {
      const content = buildAccountsContent({
        steamDown: false,
        ttlSeconds: 60,
        language,
        ...input,
      });
      assert.deepEqual(validateWidgetContent(content), [], JSON.stringify({ input, language }));
      assert.ok(content.components.length <= 8);
      assert.ok(content.components.filter((c) => c.type === 'text').length <= 2);
    }
  }
});

test('a row shows the game and the session, cutting the name, never the duration', () => {
  const content = buildAccountsContent({
    configured: true,
    steamDown: false,
    ttlSeconds: 60,
    language: 'fr',
    accounts: [
      {
        ...account(1, { gameId: '1', gameName: 'A game with a very very very long name, really' }),
        sessionMinutes: 125,
      },
      account(2, { personastate: 2 }),
    ],
  });
  const status = content.components.find((c) => c.type === 'status');
  assert.match(status.items[0].value, /^A game with a very .*… · 2 h 05$/);
  assert.equal(status.items[0].value.length, 40);
  assert.equal(status.items[0].color, 'success');
  assert.deepEqual(status.items[1], {
    label: 'player2',
    value: 'Occupé',
    icon: 'moon',
    color: 'warning',
  });
  assert.equal(formatMinutes(45, 'de'), '45 Min.');
});

test('the widget served by the integration lists the accounts and names the private ones', async () => {
  const world = await createWorld();
  try {
    const ack = await world.gladys.fake.widgetGet('accounts', { language: 'es' });
    const { components } = ack.data.content;
    assert.deepEqual(validateWidgetContent(ack.data.content), []);
    const status = components.find((c) => c.type === 'status');
    assert.deepEqual(
      status.items.map((item) => [item.label, item.value]),
      [
        ['testaccount1', 'The Witcher: Enhanced Edition'],
        ['testaccount2', 'Ocupado'],
        ['unconfigured_account', 'Desconectado'],
      ],
    );
    assert.match(components.find((c) => c.type === 'text').text, /Perfil privado.*testaccount2/);
    assert.ok(ID1 && ID2);
  } finally {
    await world.cleanup();
  }
});
