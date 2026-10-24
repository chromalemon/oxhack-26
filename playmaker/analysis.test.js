import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeScenario, createDefaultScenario, getOpponentFeatures, getPlayAnimation, normalizeScenario, MAX_PLAYERS_PER_TEAM, PLAY_TYPES, predictWithModel } from './analysis.js';

test('normalizes incomplete scenarios to safe defaults', () => {
  const scenario = normalizeScenario({ risk: 'not-a-number', players: [{ x: 2, y: -1 }] });
  assert.equal(scenario.risk, 62);
  assert.deepEqual(scenario.players[0], { x: 1, y: 0 });
  assert.deepEqual(scenario.ball, { x: 0.52, y: 0.51 });
});

test('returns ranked recommendations with bounded probabilities', () => {
  const result = analyzeScenario(createDefaultScenario());
  assert.equal(result.recommendations.length, 4);
  assert.ok(result.recommendations.every((recommendation) => recommendation.probability >= 0.08 && recommendation.probability <= 0.94));
  assert.ok(result.recommendations[0].probability >= result.recommendations[1].probability);
  assert.equal(result.modelVersion, '0.4-local');
});

test('limits each team to eleven players', () => {
  const players = Array.from({ length: 13 }, (_, index) => ({ id: `home-${index}`, x: 0.2, y: index / 13, team: 'home' }));
  players.push({ id: 'away-1', x: 0.8, y: 0.5, team: 'away' });
  const scenario = normalizeScenario({ players });
  assert.equal(scenario.players.filter((player) => player.team === 'home').length, MAX_PLAYERS_PER_TEAM);
  assert.equal(scenario.players.filter((player) => player.team === 'away').length, 1);
});

test('preserves custom team names and clamps match minute', () => {
  const scenario = normalizeScenario({ homeTeam: '  North City  ', awayTeam: 'South Town', minute: 130 });
  assert.equal(scenario.homeTeam, 'North City');
  assert.equal(scenario.awayTeam, 'South Town');
  assert.equal(scenario.minute, 120);
});

test('recommendations explain fit and failure risk using the active away team', () => {
  const result = analyzeScenario({ ...createDefaultScenario(), homeTeam: 'North City', awayTeam: 'South Town' });
  assert.ok(result.recommendations.every((recommendation) => recommendation.why && recommendation.failureRisk));
  assert.match(result.insight, /South Town|shape|space|pressure/i);
});

test('opponent positions increase pressure and change the tactical insight', () => {
  const scenario = createDefaultScenario();
  scenario.players = Array.from({ length: 4 }, (_, index) => ({ id: `away-${index}`, team: 'away', x: 0.52, y: 0.5 + index * 0.02 }));
  const features = getOpponentFeatures(scenario);
  assert.equal(features.nearbyCount, 4);
  assert.ok(features.pressure > 0);
  assert.match(analyzeScenario(scenario).insight, /Brighton|opponents/i);
});

test('higher pressure favors a safe recycle recommendation', () => {
  const result = analyzeScenario({ ...createDefaultScenario(), players: Array.from({ length: 10 }, (_, index) => ({ id: String(index), x: 0.2, y: 0.5 })) });
  assert.equal(result.recommendations[0].id, 'safe-recycle');
  assert.match(result.insight, /recycle/i);
});

test('positive mentality and risk appetite support progressive play', () => {
  const cautious = analyzeScenario({ ...createDefaultScenario(), mentality: 'conservative', risk: 10 });
  const bold = analyzeScenario({ ...createDefaultScenario(), mentality: 'positive', risk: 90 });
  const cautiousProgressive = cautious.recommendations.find((item) => item.id === 'progressive-pass');
  const boldProgressive = bold.recommendations.find((item) => item.id === 'progressive-pass');
  assert.ok(boldProgressive.probability > cautiousProgressive.probability);
});

test('uses a supplied model artifact to influence action scores', () => {
  const model = { labels: ['Pass', 'Carry', 'Dribble', 'Shot', 'Other'], weights: [[0, 0, 0, 0, 0, 0], [4, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0]], bias: [0, 0, 0, 0, 0] };
  const probabilities = predictWithModel(model, [0.9, 0.5, 0.1, 1, 0.4, 0.5]);
  assert.ok(probabilities.Carry > probabilities.Pass);
  const result = analyzeScenario(createDefaultScenario(), model);
  assert.ok(result.recommendations.some((recommendation) => recommendation.id === 'carry-forward'));
});

test('every recommendation type has an animation explanation', () => {
  PLAY_TYPES.forEach((play) => {
    const animation = getPlayAnimation(play.id);
    assert.equal(animation.phases.length, 3);
    assert.ok(animation.explanation.length > 20);
  });
});
