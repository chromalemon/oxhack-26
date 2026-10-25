export const PLAY_TYPES = Object.freeze([
  { id: 'progressive-pass', label: 'Progressive pass', detail: 'Into the most dangerous available lane' },
  { id: 'switch-of-play', label: 'Switch of play', detail: 'Move the opponent and find the free side' },
  { id: 'carry-forward', label: 'Carry forward', detail: 'Attack the open channel with the ball' },
  { id: 'safe-recycle', label: 'Safe recycle', detail: 'Keep possession and reset the shape' },
]);
export const MAX_PLAYERS_PER_TEAM = 11;
export const MODEL_VERSION = '0.5-local';
export const FEATURE_NAMES = Object.freeze(['ballX', 'ballY', 'forwardSpace', 'centrality', 'period', 'minute', 'nearbyOpponents', 'nearestOpponent', 'opponentPressure']);

export const FORMATIONS = Object.freeze({
  '4-3-3': [
    { role: 'GK', x: 0.08, y: 0.5 }, { role: 'RB', x: 0.22, y: 0.86 }, { role: 'RCB', x: 0.2, y: 0.64 }, { role: 'LCB', x: 0.2, y: 0.36 }, { role: 'LB', x: 0.22, y: 0.14 },
    { role: 'CM', x: 0.38, y: 0.5 }, { role: 'RCM', x: 0.4, y: 0.7 }, { role: 'LCM', x: 0.4, y: 0.3 }, { role: 'RW', x: 0.62, y: 0.84 }, { role: 'ST', x: 0.7, y: 0.5 }, { role: 'LW', x: 0.62, y: 0.16 },
  ],
  '4-4-2': [
    { role: 'GK', x: 0.08, y: 0.5 }, { role: 'RB', x: 0.22, y: 0.86 }, { role: 'RCB', x: 0.2, y: 0.64 }, { role: 'LCB', x: 0.2, y: 0.36 }, { role: 'LB', x: 0.22, y: 0.14 },
    { role: 'RM', x: 0.48, y: 0.84 }, { role: 'RCM', x: 0.42, y: 0.62 }, { role: 'LCM', x: 0.42, y: 0.38 }, { role: 'LM', x: 0.48, y: 0.16 }, { role: 'RST', x: 0.68, y: 0.6 }, { role: 'LST', x: 0.68, y: 0.4 },
  ],
  '3-5-2': [
    { role: 'GK', x: 0.08, y: 0.5 }, { role: 'RCB', x: 0.22, y: 0.72 }, { role: 'CB', x: 0.2, y: 0.5 }, { role: 'LCB', x: 0.22, y: 0.28 }, { role: 'RWB', x: 0.46, y: 0.88 },
    { role: 'RCM', x: 0.4, y: 0.64 }, { role: 'CM', x: 0.4, y: 0.5 }, { role: 'LCM', x: 0.4, y: 0.36 }, { role: 'LWB', x: 0.46, y: 0.12 }, { role: 'RST', x: 0.68, y: 0.6 }, { role: 'LST', x: 0.68, y: 0.4 },
  ],
  '4-2-3-1': [
    { role: 'GK', x: 0.08, y: 0.5 }, { role: 'RB', x: 0.22, y: 0.86 }, { role: 'RCB', x: 0.2, y: 0.64 }, { role: 'LCB', x: 0.2, y: 0.36 }, { role: 'LB', x: 0.22, y: 0.14 },
    { role: 'RDM', x: 0.36, y: 0.62 }, { role: 'LDM', x: 0.36, y: 0.38 }, { role: 'RAM', x: 0.56, y: 0.76 }, { role: 'CAM', x: 0.56, y: 0.5 }, { role: 'LAM', x: 0.56, y: 0.24 }, { role: 'ST', x: 0.72, y: 0.5 },
  ],
});

export const PLAY_ANIMATIONS = Object.freeze({
  'progressive-pass': { title: 'Progressive pass', phases: ['Hold the exact shape', 'Commit the open lane', 'Receive beyond the line'], explanation: 'The ball moves from the placed carrier into the most advanced available teammate before Brighton can reset.' },
  'switch-of-play': { title: 'Switch of play', phases: ['Draw pressure inside', 'Release across the pitch', 'Attack the weak side'], explanation: 'The move pulls Brighton toward the ball before changing the point of attack into the open wide channel.' },
  'carry-forward': { title: 'Carry forward', phases: ['Secure possession', 'Drive into the channel', 'Commit the defender'], explanation: 'The placed ball carrier attacks open grass directly, forcing the nearest defender to choose between stepping out and protecting depth.' },
  'safe-recycle': { title: 'Safe recycle', phases: ['Protect the ball', 'Reset the shape', 'Build again'], explanation: 'The ball travels back to the nearest supporting player, lowering immediate turnover risk and giving the team time to stretch the defence.' },
});

const HISTORICAL_MOMENTS = [
  { id: 'high-press', league: 'Bundesliga', competition: 'league', outcome: 'safe-recycle', ball: { x: 0.5, y: 0.5 }, nearby: 4 },
  { id: 'open-halfspace', league: 'Premier League', competition: 'league', outcome: 'progressive-pass', ball: { x: 0.62, y: 0.38 }, nearby: 1 },
  { id: 'wide-switch', league: 'La Liga', competition: 'cup', outcome: 'switch-of-play', ball: { x: 0.48, y: 0.78 }, nearby: 2 },
  { id: 'carry-channel', league: 'Bundesliga', competition: 'league', outcome: 'carry-forward', ball: { x: 0.58, y: 0.5 }, nearby: 0 },
];

const DEFAULT_SCENARIO = {
  name: 'Untitled scenario',
  notes: '',
  annotations: [],
  homeTeam: 'Arsenal',
  awayTeam: 'Brighton',
  gameState: 'open-play',
  mentality: 'positive',
  risk: 62,
  score: { home: 2, away: 1 },
  minute: 72,
  possession: 'home',
  cards: { homeYellow: 0, homeRed: 0, awayYellow: 0, awayRed: 0 },
  substitutions: { home: 0, away: 0 },
  formation: { home: '4-3-3', away: '4-4-2' },
  league: 'Premier League',
  competition: 'league',
  players: [
    { id: 'player-1', number: 1, team: 'home', role: 'CM', x: 0.28, y: 0.54 },
    { id: 'player-2', number: 2, team: 'home', role: 'CAM', x: 0.41, y: 0.39 },
    { id: 'player-3', number: 3, team: 'home', role: 'ST', x: 0.48, y: 0.64 },
  ],
  ball: { x: 0.52, y: 0.51 },
};

export function createDefaultScenario() {
  return structuredClone(DEFAULT_SCENARIO);
}

export function createOnboardingScenario() {
  const scenario = createDefaultScenario();
  scenario.name = 'Example: half-space combination';
  scenario.notes = 'First-time setup with a 4-3-3 against a 4-4-2 mid-block.';
  Object.assign(scenario, applyFormation(scenario, 'home', '4-3-3'));
  Object.assign(scenario, applyFormation(scenario, 'away', '4-4-2'));
  scenario.ball = { x: 0.4, y: 0.48 };
  return scenario;
}

export function normalizeScenario(input = {}) {
  const scenario = { ...createDefaultScenario(), ...input };
  scenario.name = typeof scenario.name === 'string' && scenario.name.trim() ? scenario.name.trim().slice(0, 80) : DEFAULT_SCENARIO.name;
  scenario.notes = typeof scenario.notes === 'string' ? scenario.notes.trim().slice(0, 800) : '';
  scenario.annotations = Array.isArray(scenario.annotations) ? scenario.annotations.slice(0, 40) : [];
  scenario.homeTeam = normalizeTeamName(scenario.homeTeam, DEFAULT_SCENARIO.homeTeam);
  scenario.awayTeam = normalizeTeamName(scenario.awayTeam, DEFAULT_SCENARIO.awayTeam);
  scenario.risk = clamp(Number(scenario.risk), 0, 100, DEFAULT_SCENARIO.risk);
  scenario.minute = clamp(Number(scenario.minute), 0, 120, DEFAULT_SCENARIO.minute);
  scenario.possession = scenario.possession === 'away' ? 'away' : 'home';
  scenario.league = normalizeTeamName(scenario.league, DEFAULT_SCENARIO.league);
  scenario.competition = ['league', 'cup', 'europe'].includes(scenario.competition) ? scenario.competition : 'league';
  scenario.formation = {
    home: FORMATIONS[scenario.formation?.home] ? scenario.formation.home : '4-3-3',
    away: FORMATIONS[scenario.formation?.away] ? scenario.formation.away : '4-4-2',
  };
  scenario.players = limitPlayersByTeam(Array.isArray(scenario.players) ? scenario.players.map(normalizeMarker).filter(Boolean) : []);
  const ball = normalizeMarker(scenario.ball);
  scenario.ball = ball ? { x: ball.x, y: ball.y } : { ...DEFAULT_SCENARIO.ball };
  scenario.score = {
    home: clamp(Number(scenario.score?.home), 0, 30, DEFAULT_SCENARIO.score.home),
    away: clamp(Number(scenario.score?.away), 0, 30, DEFAULT_SCENARIO.score.away),
  };
  scenario.cards = {
    homeYellow: clamp(Number(scenario.cards?.homeYellow), 0, 11, 0),
    homeRed: clamp(Number(scenario.cards?.homeRed), 0, 2, 0),
    awayYellow: clamp(Number(scenario.cards?.awayYellow), 0, 11, 0),
    awayRed: clamp(Number(scenario.cards?.awayRed), 0, 2, 0),
  };
  scenario.substitutions = {
    home: clamp(Number(scenario.substitutions?.home), 0, 5, 0),
    away: clamp(Number(scenario.substitutions?.away), 0, 5, 0),
  };
  return scenario;
}

export function applyFormation(input, team, formationId) {
  const scenario = normalizeScenario(input);
  const template = FORMATIONS[formationId];
  if (!template) return scenario;
  const others = scenario.players.filter((player) => (player.team || 'home') !== team);
  const placed = template.map((spot, index) => ({
    id: `${team}-${formationId}-${index}`,
    number: index + 1,
    team,
    role: spot.role,
    x: team === 'away' ? 1 - spot.x : spot.x,
    y: spot.y,
  }));
  scenario.players = limitPlayersByTeam([...others, ...placed]);
  scenario.formation = { ...scenario.formation, [team]: formationId };
  return scenario;
}

export function analyzeScenario(input, model = null) {
  const scenario = normalizeScenario(input);
  const forwardSpace = Math.max(0, 1 - scenario.ball.x);
  const attackingPlayers = scenario.players.filter((player) => player.x >= scenario.ball.x - 0.12).length;
  const width = getWidth(scenario.players);
  const opponentFeatures = getOpponentFeatures(scenario);
  const shape = getTeamShape(scenario);
  const context = matchContextBias(scenario);
  const pressure = Math.min(1, Math.max(0, (scenario.players.length - attackingPlayers + 1) / 8 + opponentFeatures.pressure * 0.6));
  const riskBias = (scenario.risk - 50) / 100;
  const mentalityBias = scenario.mentality === 'conservative' ? -0.08 : scenario.mentality === 'positive' ? 0.08 : 0;
  const namedFeatures = modelFeaturesNamed(scenario);
  const modelProbabilities = model ? predictWithModel(model, namedFeatures.map((item) => item.value)) : {};
  const coverage = getDataCoverage(scenario, model);

  const scores = {
    'progressive-pass': 0.56 + forwardSpace * 0.18 + attackingPlayers * 0.025 - pressure * 0.16 - opponentFeatures.pressure * 0.1 + riskBias * 0.08 + mentalityBias + context.progressive + modelBoost(modelProbabilities.Pass),
    'switch-of-play': 0.48 + width * 0.2 + riskBias * 0.04 + context.switch + modelBoost(modelProbabilities.Pass),
    'carry-forward': 0.42 + forwardSpace * 0.2 + riskBias * 0.14 - pressure * 0.12 - opponentFeatures.pressure * 0.08 + mentalityBias + context.carry + modelBoost(modelProbabilities.Carry),
    'safe-recycle': 0.6 + pressure * 0.2 - riskBias * 0.16 - mentalityBias + context.recycle + modelBoost(modelProbabilities.Other),
  };

  const recommendations = PLAY_TYPES.map((play) => {
    const probability = clamp(scores[play.id], 0.08, 0.94, 0.5);
    const territoryGain = play.id === 'switch-of-play' ? 13 + width * 12 : play.id === 'safe-recycle' ? 4 : 7 + forwardSpace * 10;
    const turnoverRisk = round(clamp(play.id === 'safe-recycle' ? 0.18 + pressure * 0.1 : 0.28 + pressure * 0.45 + opponentFeatures.nearbyCount * 0.04, 0.08, 0.92, 0.4), 2);
    const shotCreation = round(clamp((play.id === 'progressive-pass' ? 0.42 : play.id === 'carry-forward' ? 0.38 : play.id === 'switch-of-play' ? 0.33 : 0.12) + forwardSpace * 0.3 - pressure * 0.2, 0.05, 0.9, 0.2), 2);
    const risk = probability >= 0.68 ? 'low' : probability >= 0.52 ? 'medium' : 'high';
    return {
      id: play.id,
      label: play.label,
      detail: play.detail,
      probability: round(probability, 2),
      expectedGain: round(territoryGain, 1),
      territoryGain: round(territoryGain, 1),
      turnoverRisk,
      shotCreation,
      risk,
      confidence: probability >= 0.68 ? 'High confidence' : probability >= 0.52 ? 'Good option' : 'Situational',
      why: playReason(play.id, scenario, opponentFeatures, probability),
      failureRisk: playFailureRisk(play.id, scenario, opponentFeatures),
    };
  }).sort((a, b) => b.probability - a.probability);

  const picks = {
    safest: [...recommendations].sort((a, b) => a.turnoverRisk - b.turnoverRisk || b.probability - a.probability)[0],
    highestUpside: [...recommendations].sort((a, b) => b.shotCreation * b.territoryGain - a.shotCreation * a.territoryGain)[0],
    bestBalance: [...recommendations].sort((a, b) => b.probability / (0.35 + b.turnoverRisk) - a.probability / (0.35 + a.turnoverRisk))[0],
  };

  return {
    recommendations,
    picks,
    insight: buildInsight({ forwardSpace, width, pressure, opponentFeatures, scenario }),
    modelVersion: model?.model_version || MODEL_VERSION,
    sampleSize: coverage.events,
    modelConfidence: coverage.confidence,
    dataCoverage: coverage,
    influence: explainInputs(namedFeatures, modelProbabilities, recommendations[0]),
    inputFeatures: namedFeatures.map((feature) => feature.value),
    historical: compareWithHistory(scenario, recommendations[0]),
    shape,
    lanes: getPassingLanes(scenario),
    heatmaps: {
      pressure: getHeatmap(scenario, 'pressure'),
      space: getHeatmap(scenario, 'space'),
    },
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

export function getOpponentFeatures(scenario) {
  const opponents = scenario.players.filter((player) => player.team === 'away');
  const distances = opponents.map((player) => Math.hypot(player.x - scenario.ball.x, player.y - scenario.ball.y));
  const nearbyCount = distances.filter((distance) => distance <= 0.15).length;
  const nearest = Math.min(...distances, 1);
  const pressure = Math.min(1, distances.reduce((total, distance) => total + 1 / (1 + distance * 6), 0) / 11);
  return { nearbyCount, nearest, pressure };
}

export function getTeamShape(scenario) {
  const home = scenario.players.filter((player) => (player.team || 'home') === 'home');
  const away = scenario.players.filter((player) => player.team === 'away');
  const defensiveLine = away.length ? away.reduce((total, player) => total + player.x, 0) / away.length : 0.72;
  const width = getWidth(home);
  const depth = home.length ? Math.max(...home.map((player) => player.x)) - Math.min(...home.map((player) => player.x)) : 0;
  const compactness = round(1 - Math.min(1, width * 0.6 + depth * 0.4), 2);
  return { defensiveLine: round(defensiveLine, 3), width: round(width, 3), depth: round(depth, 3), compactness, homeCount: home.length, awayCount: away.length };
}

export function getPassingLanes(scenario) {
  const carrier = nearestPlayer(scenario, 'home');
  const teammates = scenario.players.filter((player) => (player.team || 'home') === 'home' && player.id !== carrier?.id);
  const opponents = scenario.players.filter((player) => player.team === 'away');
  return teammates.map((player) => {
    const blockers = opponents.filter((opponent) => pointToSegmentDistance(opponent, scenario.ball, player) < 0.045);
    return {
      id: `${carrier?.id || 'ball'}->${player.id}`,
      from: { x: scenario.ball.x, y: scenario.ball.y },
      to: { x: player.x, y: player.y, id: player.id, number: player.number, role: player.role },
      blocked: blockers.length > 0,
      blockers: blockers.map((blocker) => blocker.id),
    };
  });
}

export function getHeatmap(scenario, kind = 'pressure', cols = 12, rows = 8) {
  const opponents = scenario.players.filter((player) => player.team === 'away');
  const cells = [];
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const x = (col + 0.5) / cols;
      const y = (row + 0.5) / rows;
      const pressure = Math.min(1, opponents.reduce((total, player) => total + 1 / (1 + Math.hypot(player.x - x, player.y - y) * 8), 0) / 6);
      cells.push({ x, y, col, row, value: round(kind === 'space' ? 1 - pressure : pressure, 3) });
    }
  }
  return { cols, rows, cells };
}

export function getPlayAnimation(playId, teams = {}) {
  const animation = PLAY_ANIMATIONS[playId] || PLAY_ANIMATIONS['safe-recycle'];
  const awayTeam = teams.awayTeam || 'the opposition';
  return { ...animation, explanation: animation.explanation.replaceAll('Brighton', awayTeam) };
}

export function buildPlayTimeline(input, playId) {
  const scenario = normalizeScenario(input);
  const startPlayers = scenario.players.map((player) => ({ ...player }));
  const ball = { ...scenario.ball };
  const carrier = nearestPlayer(scenario, 'home') || startPlayers.find((player) => (player.team || 'home') === 'home');
  const target = selectPlayTarget(scenario, playId, carrier);
  const lanes = getPassingLanes(scenario);
  const pressureShift = startPlayers.map((player) => {
    if (player.team !== 'away') return { ...player };
    return {
      ...player,
      x: clamp(player.x + (ball.x - player.x) * 0.18, 0, 1, player.x),
      y: clamp(player.y + (ball.y - player.y) * 0.18, 0, 1, player.y),
    };
  });
  const actionPlayers = pressureShift.map((player) => {
    if (player.id === carrier?.id && playId === 'carry-forward') return { ...player, x: target.x, y: target.y };
    if (player.id === target.id) return { ...player, x: clamp(target.x + 0.02, 0, 1, target.x), y: target.y };
    if (player.team === 'away') {
      return {
        ...player,
        x: clamp(player.x + (target.x - player.x) * 0.28, 0, 1, player.x),
        y: clamp(player.y + (target.y - player.y) * 0.28, 0, 1, player.y),
      };
    }
    return player;
  });
  const finishPlayers = actionPlayers.map((player) => {
    if (player.team !== 'away') return player;
    return {
      ...player,
      x: clamp(player.x + (target.x - player.x) * 0.12, 0, 1, player.x),
      y: clamp(player.y + (target.y - player.y) * 0.12, 0, 1, player.y),
    };
  });
  const phases = [
    { t: 0, label: 'Exact pitch', players: startPlayers, ball },
    { t: 0.32, label: 'Opponent pressure', players: pressureShift, ball },
    { t: 0.68, label: PLAY_ANIMATIONS[playId]?.phases[1] || 'Action', players: actionPlayers, ball: { x: target.x, y: target.y } },
    { t: 1, label: PLAY_ANIMATIONS[playId]?.phases[2] || 'Finish', players: finishPlayers, ball: { x: target.x, y: target.y } },
  ];
  return { playId, phases, lanes, target, carrierId: carrier?.id || null, duration: 1 };
}

export function interpolateTimeline(timeline, time) {
  const t = clamp(Number(time), 0, 1, 0);
  const nextIndex = timeline.phases.findIndex((phase) => phase.t >= t);
  const next = timeline.phases[nextIndex] || timeline.phases.at(-1);
  const previous = timeline.phases[Math.max(0, nextIndex - 1)] || timeline.phases[0];
  const span = Math.max(0.0001, next.t - previous.t);
  const mix = next.t === previous.t ? 0 : (t - previous.t) / span;
  const players = previous.players.map((player) => {
    const counterpart = next.players.find((item) => item.id === player.id) || player;
    return { ...player, x: lerp(player.x, counterpart.x, mix), y: lerp(player.y, counterpart.y, mix) };
  });
  return {
    t,
    label: mix < 0.5 ? previous.label : next.label,
    players,
    ball: { x: lerp(previous.ball.x, next.ball.x, mix), y: lerp(previous.ball.y, next.ball.y, mix) },
  };
}

export function compareScenarios(leftInput, rightInput, model = null) {
  const left = analyzeScenario(leftInput, model);
  const right = analyzeScenario(rightInput, model);
  return {
    left,
    right,
    deltas: PLAY_TYPES.map((play) => {
      const leftPlay = left.recommendations.find((item) => item.id === play.id);
      const rightPlay = right.recommendations.find((item) => item.id === play.id);
      return { id: play.id, label: play.label, probability: round((rightPlay?.probability || 0) - (leftPlay?.probability || 0), 3) };
    }),
  };
}

export function getModelDashboard(feedback = [], model = null) {
  const total = feedback.length;
  const correct = feedback.filter((item) => item.predicted === item.actual).length;
  const byPlay = Object.fromEntries(PLAY_TYPES.map((play) => {
    const rows = feedback.filter((item) => item.predicted === play.id);
    const hits = rows.filter((item) => item.actual === play.id).length;
    return [play.id, { samples: rows.length, accuracy: rows.length ? round(hits / rows.length, 3) : null }];
  }));
  return {
    samples: total,
    accuracy: total ? round(correct / total, 3) : model?.test_accuracy ?? null,
    byPlay,
    modelVersion: model?.model_version || MODEL_VERSION,
    coverage: model ? { matches: model.matches || 0, samples: model.samples || 0, competition: model.competition || 'unknown' } : { matches: 0, samples: 0, competition: 'local-baseline' },
  };
}

export function retrainModel(model, samples, learningRate = 0.08) {
  if (!model?.weights || !samples.length) return model;
  const next = {
    ...model,
    weights: model.weights.map((row) => row.slice()),
    bias: model.bias.slice(),
    model_version: `${model.model_version || MODEL_VERSION}-feedback`,
  };
  const labels = next.labels || ['Pass', 'Carry', 'Dribble', 'Shot', 'Other'];
  for (const sample of samples) {
    const probabilities = predictWithModel(next, sample.features);
    const values = labels.map((label) => probabilities[label] || 0);
    const target = labels.indexOf(sample.label);
    if (target < 0) continue;
    for (let classIndex = 0; classIndex < labels.length; classIndex += 1) {
      const error = values[classIndex] - (classIndex === target ? 1 : 0);
      for (let featureIndex = 0; featureIndex < next.weights[classIndex].length; featureIndex += 1) {
        next.weights[classIndex][featureIndex] -= learningRate * error * (sample.features[featureIndex] || 0);
      }
      next.bias[classIndex] -= learningRate * error;
    }
  }
  return next;
}

export function filterHistoricalMoments(filters = {}, moments = HISTORICAL_MOMENTS) {
  return moments.filter((moment) => {
    if (filters.league && moment.league !== filters.league) return false;
    if (filters.competition && moment.competition !== filters.competition) return false;
    if (filters.team && moment.team !== filters.team) return false;
    if (filters.player && moment.player !== filters.player) return false;
    return true;
  });
}

export function markerAriaLabel(marker, type, teams = {}) {
  if (type === 'ball') return 'Ball';
  const teamName = marker.team === 'away' ? teams.awayTeam || 'Away' : teams.homeTeam || 'Home';
  const role = marker.role ? `, ${marker.role}` : '';
  return `${teamName} player ${marker.number}${role}`;
}

function selectPlayTarget(scenario, playId, carrier) {
  const home = scenario.players.filter((player) => (player.team || 'home') === 'home');
  const lanes = getPassingLanes(scenario);
  const open = lanes.filter((lane) => !lane.blocked);
  if (playId === 'safe-recycle') {
    const support = home.filter((player) => player.id !== carrier?.id && player.x <= scenario.ball.x).sort((a, b) => Math.hypot(a.x - scenario.ball.x, a.y - scenario.ball.y) - Math.hypot(b.x - scenario.ball.x, b.y - scenario.ball.y))[0];
    return support || { x: clamp(scenario.ball.x - 0.18, 0, 1, 0.3), y: scenario.ball.y };
  }
  if (playId === 'switch-of-play') {
    const opposite = home.filter((player) => player.id !== carrier?.id).sort((a, b) => Math.abs(b.y - scenario.ball.y) - Math.abs(a.y - scenario.ball.y))[0];
    return opposite || { x: scenario.ball.x + 0.12, y: scenario.ball.y < 0.5 ? 0.82 : 0.18 };
  }
  if (playId === 'carry-forward') {
    return { id: carrier?.id, x: clamp(scenario.ball.x + 0.16, 0, 1, 0.7), y: scenario.ball.y };
  }
  const progressive = (open.length ? open : lanes).map((lane) => home.find((player) => player.id === lane.to.id)).filter(Boolean).sort((a, b) => b.x - a.x)[0];
  return progressive || { x: clamp(scenario.ball.x + 0.22, 0, 1, 0.75), y: clamp(scenario.ball.y - 0.08, 0, 1, scenario.ball.y) };
}

function nearestPlayer(scenario, team) {
  return scenario.players.filter((player) => (player.team || 'home') === team).sort((a, b) => Math.hypot(a.x - scenario.ball.x, a.y - scenario.ball.y) - Math.hypot(b.x - scenario.ball.x, b.y - scenario.ball.y))[0];
}

function pointToSegmentDistance(point, start, end) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 0.0001;
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / (length * length), 0, 1, 0);
  return Math.hypot(point.x - (start.x + t * dx), point.y - (start.y + t * dy));
}

function matchContextBias(scenario) {
  const trailing = scenario.score.home < scenario.score.away ? 0.07 : scenario.score.home > scenario.score.away ? -0.04 : 0;
  const late = scenario.minute >= 80 ? 0.04 : 0;
  const redCard = (scenario.cards.awayRed - scenario.cards.homeRed) * 0.05;
  const possession = scenario.possession === 'away' ? -0.03 : 0.02;
  return {
    progressive: trailing + late + redCard + (scenario.gameState === 'counter-attack' ? 0.05 : 0),
    switch: scenario.gameState === 'set-piece' ? -0.04 : 0.02,
    carry: trailing * 0.6 + possession,
    recycle: -trailing + (scenario.substitutions.home >= 3 ? 0.03 : 0),
  };
}

function modelFeaturesNamed(scenario) {
  const opponentFeatures = getOpponentFeatures(scenario);
  const values = [scenario.ball.x, scenario.ball.y, 1 - scenario.ball.x, 1 - Math.abs(scenario.ball.y - 0.5) * 2, 0.4, scenario.minute / 120, opponentFeatures.nearbyCount / 11, opponentFeatures.nearest, opponentFeatures.pressure];
  return FEATURE_NAMES.map((name, index) => ({ name, value: round(values[index], 4) }));
}

function explainInputs(features, modelProbabilities, topPlay) {
  const ranked = [...features].sort((a, b) => Math.abs(b.value - 0.5) - Math.abs(a.value - 0.5));
  return {
    topPlay: topPlay?.id,
    modelAction: Object.entries(modelProbabilities).sort((a, b) => b[1] - a[1])[0]?.[0] || null,
    features: ranked.slice(0, 5),
  };
}

function getDataCoverage(scenario, model) {
  const events = Number(model?.samples) || 0;
  const matches = Number(model?.matches) || 0;
  const coverageScore = events ? Math.min(1, matches / 40) * 0.5 + Math.min(1, events / 50000) * 0.5 : 0;
  const confidence = round(clamp(0.2 + coverageScore * 0.55 + (scenario.players.length / 22) * 0.2, 0.2, 0.95, 0.2), 2);
  return { events, matches, competition: model?.competition || 'local baseline (no training data)', league: scenario.league, confidence };
}

function compareWithHistory(scenario, topPlay) {
  const nearby = getOpponentFeatures(scenario).nearbyCount;
  const matchingMoments = filterHistoricalMoments({ league: scenario.league, competition: scenario.competition });
  const similar = matchingMoments
    .map((moment) => ({ ...moment, distance: Math.hypot(moment.ball.x - scenario.ball.x, moment.ball.y - scenario.ball.y) + Math.abs(moment.nearby - nearby) * 0.08 }))
    .sort((a, b) => a.distance - b.distance)[0];
  if (!similar) return { similarId: null, league: scenario.league, historicalOutcome: null, agrees: null };
  return {
    similarId: similar.id,
    league: similar.league,
    historicalOutcome: similar.outcome,
    agrees: similar.outcome === topPlay?.id,
  };
}

function normalizeMarker(marker) {
  if (!marker || !Number.isFinite(Number(marker.x)) || !Number.isFinite(Number(marker.y))) return null;
  const team = marker.team === 'away' ? 'away' : 'home';
  return {
    ...marker,
    team,
    role: typeof marker.role === 'string' ? marker.role.slice(0, 8) : undefined,
    x: clamp(Number(marker.x), 0, 1, 0.5),
    y: clamp(Number(marker.y), 0, 1, 0.5),
  };
}

function normalizeTeamName(value, fallback) {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 28) : fallback;
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

function modelBoost(probability = 0) {
  return (probability - 0.2) * 0.18;
}

function lerp(start, end, mix) {
  return start + (end - start) * mix;
}

function clamp(value, min, max, fallback) {
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}
