import { test } from 'node:test';
import assert from 'node:assert/strict';
import { THRESHOLDS, observe, sessionMinutes } from '../src/tracker.js';

const MIN = 60000;
const T0 = Date.parse('2026-10-15T18:00:00Z');

function snap(changes = {}) {
  return {
    steamid: '76561198000000001',
    name: 'kid',
    personastate: 1,
    online: true,
    gameId: null,
    gameName: null,
    public: true,
    lastLogoff: null,
    ...changes,
  };
}
const portal = { gameId: '620', gameName: 'Portal 2' };
const witcher = { gameId: '20900', gameName: 'The Witcher' };

/** Feed observations one minute apart; returns the events and the last track. */
function run(observations, { start, track } = {}) {
  let current = track;
  const events = [];
  let now = start ?? T0;
  for (const observation of observations) {
    const result = observe(current, observation, now);
    current = result.track;
    events.push(...result.events.map((event) => ({ ...event, at: (now - T0) / MIN })));
    now += MIN;
  }
  return { events, track: current, now };
}

test('the first observation is a baseline: nothing fires', () => {
  assert.deepEqual(run([snap(portal)]).events, []);
  assert.deepEqual(run([snap({ personastate: 1 })]).events, []);
});

test('starting, switching and stopping a game', () => {
  const { events } = run([snap(), snap(portal), snap(portal), snap(witcher), snap()]);
  assert.deepEqual(
    events.map(({ key, data, at }) => [at, key, data.game]),
    [
      [1, 'game_started', 'Portal 2'],
      [3, 'game_stopped', 'Portal 2'],
      [3, 'game_started', 'The Witcher'],
      [4, 'game_stopped', 'The Witcher'],
    ],
  );
  assert.equal(events[1].data.minutes, 2);
  assert.equal(events[1].data.game_id, '620');
});

test('coming online fires went_online, once', () => {
  const { events } = run([
    snap({ personastate: 0, online: false }),
    snap({ personastate: 3 }),
    snap({ personastate: 1 }),
    snap({ personastate: 0, online: false }),
    snap({ personastate: 2 }),
  ]);
  assert.deepEqual(
    events.map((event) => [event.at, event.key]),
    [
      [1, 'went_online'],
      [4, 'went_online'],
    ],
  );
});

test('each threshold fires once per session, game switches included', () => {
  const observations = [snap()];
  for (let i = 0; i < 100; i += 1) {
    observations.push(snap(i < 50 ? portal : witcher));
  }
  const { events, track, now } = run(observations);
  const reached = events.filter((event) => event.key === 'playing_for');
  assert.deepEqual(
    reached.map((event) => [event.data.minutes, event.at]),
    [
      [15, 16],
      [30, 31],
      [45, 46],
      [60, 61],
      [90, 91],
    ],
  );
  assert.equal(reached[3].data.game, 'The Witcher');
  assert.equal(sessionMinutes(track, now - MIN), 99);
  assert.ok(THRESHOLDS.includes(120));
});

test('a short break keeps the session, a long one ends it', () => {
  const playing = (n) => Array.from({ length: n }, () => snap(portal));
  const idle = (n) => Array.from({ length: n }, () => snap());
  // 20 min, 5 min break, 20 min: one session of 45 min.
  let { events } = run([snap(), ...playing(20), ...idle(5), ...playing(21)]);
  assert.deepEqual(
    events.filter((e) => e.key === 'playing_for').map((e) => e.data.minutes),
    [15, 30, 45],
  );
  // 20 min, 15 min break, 20 min: two sessions, 15 min reached twice.
  ({ events } = run([snap(), ...playing(20), ...idle(15), ...playing(21)]));
  assert.deepEqual(
    events.filter((e) => e.key === 'playing_for').map((e) => e.data.minutes),
    [15, 15],
  );
});

test('in game before and after a Steam outage: the session goes on', () => {
  let { track, now } = run([snap(), snap(portal), snap(portal)]);
  // 20 minutes without an answer, still in game.
  const later = observe(track, snap(portal), now + 20 * MIN);
  assert.equal(sessionMinutes(later.track, now + 20 * MIN), 22);
  assert.deepEqual(
    later.events.map((e) => [e.key, e.data.minutes]),
    [['playing_for', 15]],
  );
  // Nothing seen for two hours: a new session.
  const next = observe(track, snap(portal), now + 120 * MIN);
  assert.equal(sessionMinutes(next.track, now + 120 * MIN), 0);
  assert.deepEqual(next.events, []);
});

test('a non-Steam game is compared by name', () => {
  const { events } = run([
    snap(),
    snap({ gameId: null, gameName: 'Emulator' }),
    snap({ gameId: null, gameName: 'Emulator' }),
    snap({ gameId: null, gameName: 'Other' }),
  ]);
  assert.deepEqual(
    events.map((e) => [e.key, e.data.game]),
    [
      ['game_started', 'Emulator'],
      ['game_stopped', 'Emulator'],
      ['game_started', 'Other'],
    ],
  );
});
