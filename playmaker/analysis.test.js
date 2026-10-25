import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MODEL_VERSION,
  analyzeScenario,
  applyFormation,
  buildPlayTimeline,
  compareScenarios,
  createDefaultScenario,
  createOnboardingScenario,
  filterHistoricalMoments,
  getHeatmap,
  getOpponentFeatures,
  getPassingLanes,
  getPlayAnimation,
  getTeamShape,
  interpolateTimeline,
  markerAriaLabel,
  normalizeScenario,
  MAX_PLAYERS_PER_TEAM,
  PLAY_TYPES,
  predictWithModel,
  retrainModel,
  getModelDashboard,
} from './analysis.js';

test('normalizes incomplete scenarios to safe defaults', () => {
  const scenario = normalizeScenario({ risk: 'not-a-number', players: [{ x: 2, y: -1 }] });
  assert.equal(scenario.risk, 62);
  assert.equal(scenario.players[0].x, 1);
  assert.equal(scenario.players[0].y, 0);
  assert.equal(scenario.players[0].team, 'home');
  assert.deepEqual(scenario.ball, { x: 0.52, y: 0.51 });
  assert.equal(scenario.possession, 'home');
  assert.equal(scenario.cards.homeRed, 0);
});

test('returns ranked recommendations with bounded probabilities', () => {
  const result = analyzeScenario(createDefaultScenario());
  assert.equal(result.recommendations.length, 4);
  assert.ok(result.recommendations.every((recommendation) => recommendation.probability >= 0.08 && recommendation.probability <= 0.94));
  assert.ok(result.recommendations[0].probability >= result.recommendations[1].probability);
  assert.equal(result.modelVersion, MODEL_VERSION);
  assert.ok(result.picks.safest && result.picks.highestUpside && result.picks.bestBalance);
  assert.ok(result.recommendations.every((play) => play.shotCreation >= 0 && play.turnoverRisk >= 0 && play.territoryGain >= 0));
  assert.equal(result.dataCoverage.events, 0);
  assert.equal(result.dataCoverage.matches, 0);
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
  assert.ok(result.influence.features.length > 0);
});

test('every recommendation type has an animation explanation', () => {
  PLAY_TYPES.forEach((play) => {
    const animation = getPlayAnimation(play.id);
    assert.equal(animation.phases.length, 3);
    assert.ok(animation.explanation.length > 20);
  });
});

test('formations place eleven players with roles for each team', () => {
  const withHome = applyFormation(createDefaultScenario(), 'home', '4-3-3');
  const withBoth = applyFormation(withHome, 'away', '3-5-2');
  assert.equal(withBoth.players.filter((player) => player.team === 'home').length, 11);
  assert.equal(withBoth.players.filter((player) => player.team === 'away').length, 11);
  assert.equal(withBoth.formation.home, '4-3-3');
  assert.ok(withBoth.players.every((player) => player.role));
  assert.ok(withBoth.players.some((player) => player.team === 'away' && player.x > 0.5));
});

test('trailing late in a match increases progressive bias versus a winning state', () => {
  const winning = analyzeScenario({ ...createDefaultScenario(), score: { home: 3, away: 0 }, minute: 20 });
  const trailing = analyzeScenario({ ...createDefaultScenario(), score: { home: 0, away: 2 }, minute: 88, cards: { awayRed: 1 } });
  const winningProgressive = winning.recommendations.find((item) => item.id === 'progressive-pass');
  const trailingProgressive = trailing.recommendations.find((item) => item.id === 'progressive-pass');
  assert.ok(trailingProgressive.probability > winningProgressive.probability);
});

test('passing lanes mark opponents who sit on the route', () => {
  const scenario = normalizeScenario({
    ball: { x: 0.3, y: 0.5 },
    players: [
      { id: 'carrier', team: 'home', x: 0.28, y: 0.5, number: 8 },
      { id: 'target', team: 'home', x: 0.7, y: 0.5, number: 9 },
      { id: 'blocker', team: 'away', x: 0.5, y: 0.5, number: 4 },
    ],
  });
  const lanes = getPassingLanes(scenario);
  const blocked = lanes.find((lane) => lane.to.id === 'target');
  assert.equal(blocked.blocked, true);
  assert.deepEqual(blocked.blockers, ['blocker']);
});

test('timeline starts from the exact placed players and moves opponents during the play', () => {
  const scenario = applyFormation(applyFormation(createDefaultScenario(), 'home', '4-3-3'), 'away', '4-4-2');
  scenario.ball = { x: 0.4, y: 0.5 };
  const timeline = buildPlayTimeline(scenario, 'progressive-pass');
  assert.equal(timeline.phases[0].players.length, scenario.players.length);
  assert.equal(timeline.phases[0].ball.x, 0.4);
  const startAway = timeline.phases[0].players.filter((player) => player.team === 'away');
  const laterAway = timeline.phases[2].players.filter((player) => player.team === 'away');
  assert.ok(startAway.some((player, index) => player.x !== laterAway[index].x || player.y !== laterAway[index].y));
  const mid = interpolateTimeline(timeline, 0.5);
  assert.equal(mid.players.length, scenario.players.length);
  assert.ok(mid.ball.x >= 0.4);
});

test('heatmaps and defensive line describe the current shape', () => {
  const scenario = applyFormation(createDefaultScenario(), 'away', '4-4-2');
  const pressure = getHeatmap(scenario, 'pressure');
  const space = getHeatmap(scenario, 'space');
  const shape = getTeamShape(scenario);
  assert.equal(pressure.cells.length, 96);
  assert.ok(pressure.cells.some((cell) => cell.value > 0));
  assert.ok(space.cells.every((cell) => cell.value >= 0 && cell.value <= 1));
  assert.ok(shape.defensiveLine > 0);
});

test('scenario comparison reports probability deltas', () => {
  const left = createDefaultScenario();
  const right = { ...createDefaultScenario(), risk: 95, mentality: 'positive' };
  const comparison = compareScenarios(left, right);
  assert.equal(comparison.deltas.length, 4);
  assert.ok(comparison.deltas.every((delta) => Number.isFinite(delta.probability)));
});

test('model dashboard and feedback retraining stay numerically stable', () => {
  const dashboard = getModelDashboard([{ predicted: 'safe-recycle', actual: 'safe-recycle' }, { predicted: 'carry-forward', actual: 'safe-recycle' }]);
  assert.equal(dashboard.samples, 2);
  assert.equal(dashboard.accuracy, 0.5);
  const model = { labels: ['Pass', 'Carry', 'Dribble', 'Shot', 'Other'], weights: [[0, 0], [0, 0], [0, 0], [0, 0], [0, 0]], bias: [0, 0, 0, 0, 0], model_version: 'test' };
  const updated = retrainModel(model, [{ features: [1, 0], label: 'Carry' }]);
  assert.notEqual(updated.bias[1], 0);
  assert.match(updated.model_version, /feedback/);
});

test('historical filters restrict league and competition coverage', () => {
  const bundesliga = filterHistoricalMoments({ league: 'Bundesliga' });
  assert.ok(bundesliga.length >= 1);
  assert.ok(bundesliga.every((moment) => moment.league === 'Bundesliga'));
  assert.equal(filterHistoricalMoments({ league: 'MLS' }).length, 0);
  assert.equal(filterHistoricalMoments({ team: 'Arsenal' }).length, 0);
  assert.equal(filterHistoricalMoments({ player: 'Alex Morgan' }).length, 0);
});

test('accessible marker labels include team, number, and role', () => {
  assert.equal(markerAriaLabel({ team: 'home', number: 8, role: 'CM' }, 'player', { homeTeam: 'Arsenal' }), 'Arsenal player 8, CM');
  assert.equal(markerAriaLabel({}, 'ball'), 'Ball');
});

test('onboarding example places a full match shape', () => {
  const scenario = createOnboardingScenario();
  assert.ok(scenario.players.length > 10);
  assert.match(scenario.name, /Example/);
});
