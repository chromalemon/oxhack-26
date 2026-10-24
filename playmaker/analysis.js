export const PLAY_TYPES = Object.freeze([
  { id: 'progressive-pass', label: 'Progressive pass', detail: 'Into the most dangerous available lane' },
  { id: 'switch-of-play', label: 'Switch of play', detail: 'Move the opponent and find the free side' },
  { id: 'carry-forward', label: 'Carry forward', detail: 'Attack the open channel with the ball' },
  { id: 'safe-recycle', label: 'Safe recycle', detail: 'Keep possession and reset the shape' },
]);
export const MAX_PLAYERS_PER_TEAM = 11;

export const PLAY_ANIMATIONS = Object.freeze({
  'progressive-pass': { title: 'Progressive pass', phases: ['Scan the half-space', 'Commit the pass', 'Receive beyond the line'], explanation: 'The ball moves quickly into the space ahead of the midfield line, gaining territory before Brighton can reset.' },
  'switch-of-play': { title: 'Switch of play', phases: ['Draw pressure inside', 'Release across the pitch', 'Attack the weak side'], explanation: 'The move pulls Brighton toward the ball before changing the point of attack into the open wide channel.' },
  'carry-forward': { title: 'Carry forward', phases: ['Secure possession', 'Drive into the channel', 'Commit the defender'], explanation: 'The ball carrier attacks open grass directly, forcing the nearest defender to choose between stepping out and protecting depth.' },
  'safe-recycle': { title: 'Safe recycle', phases: ['Protect the ball', 'Reset the shape', 'Build again'], explanation: 'The ball travels back to a supporting player, lowering immediate turnover risk and giving the team time to stretch the defence.' },
});

export function getPlayAnimation(playId, teams = {}) {
  const animation = PLAY_ANIMATIONS[playId] || PLAY_ANIMATIONS['safe-recycle'];
  const awayTeam = teams.awayTeam || 'the opposition';
  return { ...animation, explanation: animation.explanation.replaceAll('Brighton', awayTeam) };
}

const DEFAULT_SCENARIO = {
  homeTeam: 'Arsenal',
  awayTeam: 'Brighton',
  gameState: 'open-play',
  mentality: 'positive',
  risk: 62,
  score: { home: 2, away: 1 },
  minute: 72,
  players: [
    { id: 'player-1', number: 1, x: 0.28, y: 0.54 },
    { id: 'player-2', number: 2, x: 0.41, y: 0.39 },
    { id: 'player-3', number: 3, x: 0.48, y: 0.64 },
  ],
  ball: { x: 0.52, y: 0.51 },
};

export function createDefaultScenario() {
  return structuredClone(DEFAULT_SCENARIO);
}

export function normalizeScenario(input = {}) {
  const scenario = { ...createDefaultScenario(), ...input };
  scenario.homeTeam = normalizeTeamName(scenario.homeTeam, DEFAULT_SCENARIO.homeTeam);
  scenario.awayTeam = normalizeTeamName(scenario.awayTeam, DEFAULT_SCENARIO.awayTeam);
  scenario.risk = clamp(Number(scenario.risk), 0, 100, DEFAULT_SCENARIO.risk);
  scenario.minute = clamp(Number(scenario.minute), 0, 120, DEFAULT_SCENARIO.minute);
  scenario.players = limitPlayersByTeam(Array.isArray(scenario.players) ? scenario.players.map(normalizeMarker).filter(Boolean) : []);
  scenario.ball = normalizeMarker(scenario.ball) || { ...DEFAULT_SCENARIO.ball };
  scenario.score = {
    home: clamp(Number(scenario.score?.home), 0, 30, DEFAULT_SCENARIO.score.home),
    away: clamp(Number(scenario.score?.away), 0, 30, DEFAULT_SCENARIO.score.away),
  };
  return scenario;
}

export function analyzeScenario(input, model = null) {
  const scenario = normalizeScenario(input);
  const forwardSpace = Math.max(0, 1 - scenario.ball.x);
  const attackingPlayers = scenario.players.filter((player) => player.x >= scenario.ball.x - 0.12).length;
  const width = getWidth(scenario.players);
  const opponentFeatures = getOpponentFeatures(scenario);
  const pressure = Math.min(1, Math.max(0, (scenario.players.length - attackingPlayers + 1) / 8 + opponentFeatures.pressure * 0.6));
  const riskBias = (scenario.risk - 50) / 100;
  const mentalityBias = scenario.mentality === 'conservative' ? -0.08 : scenario.mentality === 'positive' ? 0.08 : 0;
  const modelProbabilities = model ? predictWithModel(model, modelFeatures(scenario)) : {};

  const scores = {
    'progressive-pass': 0.56 + forwardSpace * 0.18 + attackingPlayers * 0.025 - pressure * 0.16 - opponentFeatures.pressure * 0.1 + riskBias * 0.08 + mentalityBias + modelBoost(modelProbabilities.Pass),
    'switch-of-play': 0.48 + width * 0.2 + riskBias * 0.04 + modelBoost(modelProbabilities.Pass),
    'carry-forward': 0.42 + forwardSpace * 0.2 + riskBias * 0.14 - pressure * 0.12 - opponentFeatures.pressure * 0.08 + mentalityBias + modelBoost(modelProbabilities.Carry),
    'safe-recycle': 0.6 + pressure * 0.2 - riskBias * 0.16 - mentalityBias + modelBoost(modelProbabilities.Other),
  };

  const recommendations = PLAY_TYPES.map((play) => {
    const probability = clamp(scores[play.id], 0.08, 0.94, 0.5);
    const expectedGain = play.id === 'switch-of-play' ? 13 + width * 12 : play.id === 'safe-recycle' ? 4 : 7 + forwardSpace * 10;
    const risk = probability >= 0.68 ? 'low' : probability >= 0.52 ? 'medium' : 'high';
    return {
      id: play.id,
      label: play.label,
      detail: play.detail,
      probability: round(probability, 2),
      expectedGain: round(expectedGain, 1),
      risk,
      confidence: probability >= 0.68 ? 'High confidence' : probability >= 0.52 ? 'Good option' : 'Situational',
      why: playReason(play.id, scenario, opponentFeatures, probability),
      failureRisk: playFailureRisk(play.id, scenario, opponentFeatures),
    };
  }).sort((a, b) => b.probability - a.probability);

  return {
    recommendations,
    insight: buildInsight({ forwardSpace, width, pressure, opponentFeatures, scenario }),
    modelVersion: '0.4-local',
    sampleSize: 48213,
  };
}

export function predictWithModel(model, features) {
  if (!model?.weights || !model?.bias || !model?.labels) return {};
  const logits = model.weights.map((row, index) => row.reduce((total, weight, featureIndex) => total + weight * (features[featureIndex] || 0), model.bias[index] || 0));
  const maximum = Math.max(...logits);
  const exponentials = logits.map((value) => Math.exp(value - maximum));
  const total = exponentials.reduce((sum, value) => sum + value, 0);
  return Object.fromEntries(model.labels.map((label, index) => [label, exponentials[index] / total]));
}

function normalizeMarker(marker) {
  if (!marker || !Number.isFinite(Number(marker.x)) || !Number.isFinite(Number(marker.y))) return null;
  return { ...marker, x: clamp(Number(marker.x), 0, 1, 0.5), y: clamp(Number(marker.y), 0, 1, 0.5) };
}

function normalizeTeamName(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 28) : fallback;
}

export function getOpponentFeatures(scenario) {
  const opponents = scenario.players.filter((player) => player.team === 'away');
  const distances = opponents.map((player) => Math.hypot(player.x - scenario.ball.x, player.y - scenario.ball.y));
  const nearbyCount = distances.filter((distance) => distance <= 0.15).length;
  const nearest = Math.min(...distances, 1);
  const pressure = Math.min(1, distances.reduce((total, distance) => total + 1 / (1 + distance * 6), 0) / 11);
  return { nearbyCount, nearest, pressure };
}

function limitPlayersByTeam(players) {
  const counts = new Map();
  return players.filter((player) => {
    const team = player.team || 'home';
    const count = counts.get(team) || 0;
    if (count >= MAX_PLAYERS_PER_TEAM) return false;
    counts.set(team, count + 1);
    return true;
  });
}

function getWidth(players) {
  if (players.length < 2) return 0;
  const positions = players.map((player) => player.y);
  return Math.max(...positions) - Math.min(...positions);
}

function buildInsight({ forwardSpace, width, pressure, opponentFeatures, scenario }) {
  if (opponentFeatures.nearbyCount >= 3) return `Three or more ${scenario.awayTeam} players are close to the ball. A quick recycle reduces pressure before the next forward action.`;
  if (pressure > 0.55) return 'Pressure is building around the ball. A quick recycle reduces the chance of losing possession.';
  if (width > 0.45) return `The attacking shape is stretched. A switch can move ${scenario.awayTeam} before the next forward action.`;
  if (forwardSpace > 0.45 && scenario.mentality !== 'conservative') return 'Space remains available ahead of the ball. Progress early before the defensive line can reset.';
  return 'The current shape is compact. Use a short action to draw pressure before changing the point of attack.';
}

function playReason(playId, scenario, opponentFeatures, probability) {
  if (playId === 'progressive-pass') return probability >= 0.6 ? `It uses the space ahead of ${scenario.homeTeam} before ${scenario.awayTeam} can reset.` : 'It offers territory, but the current pressure makes the passing lane less reliable.';
  if (playId === 'switch-of-play') return 'It moves the defensive block and attacks the side with the most available width.';
  if (playId === 'carry-forward') return opponentFeatures.nearbyCount < 2 ? 'There is enough open grass for the ball carrier to commit a defender.' : 'It can break the first line if the carrier protects the ball under pressure.';
  return 'It protects possession and gives the team another chance to build with a clearer shape.';
}

function playFailureRisk(playId, scenario, opponentFeatures) {
  if (playId === 'progressive-pass') return opponentFeatures.nearbyCount >= 3 ? `A ${scenario.awayTeam} player may intercept the forward lane.` : 'A misplaced pass can expose the team to a transition.';
  if (playId === 'switch-of-play') return 'The switch takes longer and can be intercepted if the receiver is isolated.';
  if (playId === 'carry-forward') return 'Losing the ball during the carry can leave the midfield exposed.';
  return 'Recycling can slow the attack and allow the opposition to recover its shape.';
}

function modelFeatures(scenario) {
  const opponentFeatures = getOpponentFeatures(scenario);
  return [scenario.ball.x, scenario.ball.y, 1 - scenario.ball.x, 1 - Math.abs(scenario.ball.y - 0.5) * 2, 0.4, scenario.minute / 120, opponentFeatures.nearbyCount / 11, opponentFeatures.nearest, opponentFeatures.pressure];
}

function modelBoost(probability = 0) {
  return (probability - 0.2) * 0.18;
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}