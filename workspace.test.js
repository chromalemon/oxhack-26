import test from 'node:test';
import assert from 'node:assert/strict';
import { appendVersion, compareVersions, createAnnotation, createHistory, duplicateScenario, pushHistory, redoHistory, shortcutMatches, undoHistory } from './workspace.js';
import { analyzeScenario, createDefaultScenario } from './analysis.js';

test('undo and redo restore pitch history', () => {
  const start = createDefaultScenario();
  let history = createHistory(start);
  const moved = { ...start, ball: { x: 0.7, y: 0.4 } };
  history = pushHistory(history, moved);
  history = undoHistory(history);
  assert.equal(history.present.ball.x, start.ball.x);
  history = redoHistory(history);
  assert.equal(history.present.ball.x, 0.7);
});

test('duplicate scenario copies state under a new identity', () => {
  const copy = duplicateScenario({ id: 'scenario-1', name: 'Press', state: createDefaultScenario() }, '2026-10-25T00:00:00.000Z');
  assert.notEqual(copy.id, 'scenario-1');
  assert.equal(copy.name, 'Press copy');
  assert.equal(copy.state.homeTeam, 'Arsenal');
});

test('version comparison detects a change in the top play', () => {
  const open = createDefaultScenario();
  const pressed = { ...open, players: Array.from({ length: 8 }, (_, index) => ({ id: `p${index}`, team: 'away', x: 0.52, y: 0.5 })) };
  const comparison = compareVersions(pressed, open, analyzeScenario);
  assert.equal(typeof comparison.probabilityDelta, 'number');
  assert.equal(comparison.latest.recommendations[0].id, 'progressive-pass');
});

test('annotations require text and keep a pitch coordinate', () => {
  assert.equal(createAnnotation('   '), null);
  const note = createAnnotation('Mark the weak side', { x: 0.8, y: 0.2 }, '2026-10-25T00:00:00.000Z');
  assert.equal(note.text, 'Mark the weak side');
  assert.equal(note.x, 0.8);
});

test('keyboard shortcuts match modifier combinations', () => {
  assert.equal(shortcutMatches({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: false }, { keys: ['Mod', 'Z'] }), true);
  assert.equal(shortcutMatches({ key: 'z', metaKey: true, ctrlKey: false, shiftKey: true }, { keys: ['Mod', 'Z'] }), false);
  assert.equal(shortcutMatches({ key: ' ', metaKey: false, ctrlKey: false, shiftKey: false }, { keys: ['Space'] }), true);
});

test('history ignores duplicate snapshots', () => {
  const start = createDefaultScenario();
  const history = pushHistory(createHistory(start), start);
  assert.equal(history.past.length, 0);
});

test('appendVersion keeps the newest snapshot first', () => {
  const versions = appendVersion([], createDefaultScenario(), 't1');
  const next = appendVersion(versions, { ...createDefaultScenario(), risk: 10 }, 't2');
  assert.equal(next[0].savedAt, 't2');
  assert.equal(next[0].state.risk, 10);
  assert.equal(next.length, 2);
});
