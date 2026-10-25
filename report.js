import { analyzeScenario, buildPlayTimeline, getPassingLanes, getTeamShape, normalizeScenario } from './analysis.js';

export function buildTacticalReport(input, model = null) {
  const scenario = normalizeScenario(input);
  const analysis = analyzeScenario(scenario, model);
  const lanes = getPassingLanes(scenario);
  const shape = getTeamShape(scenario);
  const timeline = buildPlayTimeline(scenario, analysis.recommendations[0]?.id);
  const lines = [
    `# ${scenario.name}`,
    `${scenario.homeTeam} ${scenario.score.home}-${scenario.score.away} ${scenario.awayTeam} · ${scenario.minute}' · ${scenario.possession === 'home' ? scenario.homeTeam : scenario.awayTeam} possession`,
    `Formation ${scenario.formation.home} vs ${scenario.formation.away}. Mentality ${scenario.mentality}. Risk ${scenario.risk}%.`,
    scenario.notes ? `Notes: ${scenario.notes}` : null,
    '',
    `Top recommendation: ${analysis.picks.bestBalance.label} (${Math.round(analysis.picks.bestBalance.probability * 100)}%).`,
    `Safest: ${analysis.picks.safest.label}. Highest upside: ${analysis.picks.highestUpside.label}.`,
    analysis.insight,
    `Open passing lanes: ${lanes.filter((lane) => !lane.blocked).length}. Blocked: ${lanes.filter((lane) => lane.blocked).length}.`,
    `Defensive line: ${Math.round(shape.defensiveLine * 100)}% pitch. Compactness: ${shape.compactness}.`,
    `Model ${analysis.modelVersion} · coverage ${analysis.dataCoverage.events.toLocaleString()} events · confidence ${analysis.modelConfidence}.`,
    '',
    'Recommendations',
    ...analysis.recommendations.map((play, index) => `${index + 1}. ${play.label} ${Math.round(play.probability * 100)}% · shot ${play.shotCreation} · turnover ${play.turnoverRisk} · territory +${play.territoryGain}m`),
    '',
    `Animation uses the placed ${scenario.players.length} players and starts from (${scenario.ball.x.toFixed(2)}, ${scenario.ball.y.toFixed(2)}).`,
    `First action target: (${timeline.target.x.toFixed(2)}, ${timeline.target.y.toFixed(2)}).`,
  ].filter((line) => line !== null);
  return { title: scenario.name, text: lines.join('\n'), analysis, scenario };
}

export function buildPitchSvg(input, options = {}) {
  const scenario = normalizeScenario(input);
  const lanes = options.lanes || getPassingLanes(scenario);
  const width = options.width || 720;
  const height = options.height || 460;
  const toX = (x) => (x * width).toFixed(1);
  const toY = (y) => (y * height).toFixed(1);
  const laneMarkup = lanes.map((lane) => `<line x1="${toX(lane.from.x)}" y1="${toY(lane.from.y)}" x2="${toX(lane.to.x)}" y2="${toY(lane.to.y)}" stroke="${lane.blocked ? '#f97316' : '#2563eb'}" stroke-width="2" stroke-dasharray="${lane.blocked ? '6 4' : '0'}" opacity="0.85" />`).join('');
  const players = scenario.players.map((player) => `<g><circle cx="${toX(player.x)}" cy="${toY(player.y)}" r="11" fill="${player.team === 'away' ? '#f97316' : '#2563eb'}" stroke="#fff" stroke-width="2" /><text x="${toX(player.x)}" y="${(player.y * height + 4).toFixed(1)}" text-anchor="middle" fill="#fff" font-size="10" font-family="sans-serif">${player.number}</text></g>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${escapeXml(scenario.name)}"><rect width="${width}" height="${height}" fill="#2f7d32" /><rect x="12" y="12" width="${width - 24}" height="${height - 24}" fill="none" stroke="#fff" stroke-width="2" />${laneMarkup}${players}<circle cx="${toX(scenario.ball.x)}" cy="${toY(scenario.ball.y)}" r="6" fill="#fff" stroke="#111" /></svg>`;
}

function escapeXml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[character]);
}
