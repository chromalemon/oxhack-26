import {
  FORMATIONS,
  MAX_PLAYERS_PER_TEAM,
  analyzeScenario,
  applyFormation,
  buildPlayTimeline,
  compareScenarios,
  createDefaultScenario,
  createOnboardingScenario,
  getPassingLanes,
  getPlayAnimation,
  getTeamShape,
  interpolateTimeline,
  markerAriaLabel,
  MODEL_VERSION,
} from './analysis.js';
import { buildPitchSvg, buildTacticalReport } from './report.js';
import {
  DRAFT_KEY,
  ONBOARDING_KEY,
  SHORTCUTS,
  createAnnotation,
  createHistory,
  duplicateScenario,
  appendVersion,
  compareVersions,
  pushHistory,
  readJson,
  redoHistory,
  shortcutMatches,
  undoHistory,
  writeJson,
} from './workspace.js';

const STORAGE_KEY = 'playmaker.saved-scenarios';
const THEME_KEY = 'playmaker.theme';
const pitch = document.querySelector('#pitch');
const markerLayer = document.querySelector('#markerLayer');
const pitchOverlay = document.querySelector('#pitchOverlay');
const defensiveLine = document.querySelector('#defensiveLine');
const hint = document.querySelector('#pitchHint');
const markerCount = document.querySelector('#markerCount');
const recommendations = document.querySelector('#recommendations');
const insightText = document.querySelector('#insightText');
const influenceText = document.querySelector('#influenceText');
const panelIntro = document.querySelector('#panelIntro');
const picks = document.querySelector('#picks');
const toolButtons = document.querySelectorAll('.tool-button');
const overlayButtons = document.querySelectorAll('.overlay-toggle');
const analyseButton = document.querySelector('#analyseButton');
const resetButton = document.querySelector('#resetButton');
const saveButton = document.querySelector('#saveButton');
const riskInput = document.querySelector('#risk');
const riskValue = document.querySelector('#riskValue');
const gameStateInput = document.querySelector('#gameState');
const mentalityInput = document.querySelector('#mentality');
const savedCount = document.querySelector('#savedCount');
const savedNav = document.querySelector('#savedNav');
const profileName = document.querySelector('#profileName');
const profileType = document.querySelector('#profileType');
const accountButton = document.querySelector('#accountButton');
const accountPanel = document.querySelector('#accountPanel');
const accountForm = document.querySelector('#accountForm');
const accountNameInput = document.querySelector('#accountName');
const accountEmailInput = document.querySelector('#accountEmail');
const accountPasswordInput = document.querySelector('#accountPassword');
const accountStatus = document.querySelector('#accountStatus');
const accountClose = document.querySelector('#accountClose');
const savedPanel = document.querySelector('#savedPanel');
const savedList = document.querySelector('#savedList');
const savedClose = document.querySelector('#savedClose');
const animationDialog = document.querySelector('#animationDialog');
const animationTitle = document.querySelector('#animationTitle');
const animationExplanation = document.querySelector('#animationExplanation');
const animationSteps = document.querySelector('#animationSteps');
const animationPitch = document.querySelector('#animationPitch');
const animationClose = document.querySelector('#animationClose');
const eraseBrush = document.querySelector('#eraseBrush');
const homeTeamInput = document.querySelector('#homeTeamInput');
const awayTeamInput = document.querySelector('#awayTeamInput');
const minuteInput = document.querySelector('#minuteInput');
const homeTeamLabel = document.querySelector('#homeTeamLabel');
const awayTeamLabel = document.querySelector('#awayTeamLabel');
const matchMinuteLabel = document.querySelector('#matchMinuteLabel');
const logoutButton = document.querySelector('#logoutButton');
const accountTitle = document.querySelector('#accountTitle');
const accountNameField = document.querySelector('#accountNameField');
const guestStatus = document.querySelector('#guestStatus');
const accountSubmit = document.querySelector('#accountSubmit');
const loginMode = document.querySelector('#loginMode');
const registerMode = document.querySelector('#registerMode');
const modelStatus = document.querySelector('#modelStatus');
const modelMeta = document.querySelector('#modelMeta');
const homeLegend = document.querySelector('#homeLegend');
const awayLegend = document.querySelector('#awayLegend');
const homeToolLabel = document.querySelector('#homeToolLabel');
const awayToolLabel = document.querySelector('#awayToolLabel');
const momentumLabel = document.querySelector('#momentumLabel');
const themeButton = document.querySelector('#themeButton');
const authStatus = document.querySelector('#authStatus');
const scenarioNameInput = document.querySelector('#scenarioNameInput');
const notesInput = document.querySelector('#notesInput');
const homeScoreInput = document.querySelector('#homeScoreInput');
const awayScoreInput = document.querySelector('#awayScoreInput');
const possessionInput = document.querySelector('#possessionInput');
const leagueInput = document.querySelector('#leagueInput');
const competitionInput = document.querySelector('#competitionInput');
const homeFormation = document.querySelector('#homeFormation');
const awayFormation = document.querySelector('#awayFormation');
const timelineScrubber = document.querySelector('#timelineScrubber');
const animationSpeed = document.querySelector('#animationSpeed');
const loadingVeil = document.querySelector('#loadingVeil');
const errorBanner = document.querySelector('#errorBanner');
const errorText = document.querySelector('#errorText');
const onboardingBanner = document.querySelector('#onboardingBanner');
const commentForm = document.querySelector('#commentForm');
const commentList = document.querySelector('#commentList');

let activeTool = 'player';
let state = readJson(localStorage, DRAFT_KEY, null) || createDefaultScenario();
let history = createHistory(state);
let model = null;
let account = readAccount();
let authenticated = false;
let isErasing = false;
let authMode = 'login';
let overlays = { lanes: false, heatmap: false, shape: false };
let drag = null;
let ignoreClick = false;
let analysis = null;
let timeline = null;
let animationFrame = 0;
let selectedScenarioId = null;
let autosaveTimer = 0;

function commitState(next, record = true) {
  state = next;
  if (record) history = pushHistory(history, state);
  render();
  scheduleAutosave();
}

function render() {
  analysis = analyzeScenario(state, model);
  renderMarkers();
  renderOverlays();
  renderRecommendations(analysis);
  riskInput.value = state.risk;
  riskValue.textContent = `${state.risk}%`;
  gameStateInput.value = state.gameState;
  mentalityInput.value = state.mentality;
  renderAccount();
  renderSavedCount();
  modelStatus.textContent = model ? 'Model online' : 'Tactical baseline';
  modelMeta.textContent = model?.model_version || `Local ${MODEL_VERSION}`;
  scenarioNameInput.value = state.name;
  notesInput.value = state.notes || '';
  homeTeamInput.value = state.homeTeam;
  awayTeamInput.value = state.awayTeam;
  minuteInput.value = state.minute;
  homeScoreInput.value = state.score.home;
  awayScoreInput.value = state.score.away;
  possessionInput.value = state.possession;
  leagueInput.value = state.league;
  competitionInput.value = state.competition;
  homeFormation.value = state.formation.home;
  awayFormation.value = state.formation.away;
  homeTeamLabel.textContent = state.homeTeam || 'Home team';
  awayTeamLabel.textContent = state.awayTeam || 'Away team';
  matchMinuteLabel.textContent = `${String(state.minute).padStart(2, '0')}:00`;
  document.querySelector('#homeScoreLabel').textContent = String(state.score.home);
  document.querySelector('#awayScoreLabel').textContent = String(state.score.away);
  homeLegend.textContent = state.homeTeam || 'Home team';
  awayLegend.textContent = state.awayTeam || 'Away team';
  homeToolLabel.textContent = state.homeTeam || 'Home team';
  awayToolLabel.textContent = state.awayTeam || 'Away team';
  const lead = state.score.home - state.score.away;
  momentumLabel.textContent = `${lead >= 0 ? state.homeTeam : state.awayTeam} ${lead === 0 ? 'level' : `${lead > 0 ? '+' : ''}${lead}`}`;
  document.querySelector('#footerCoverage').textContent = `Coverage ${analysis.dataCoverage.events.toLocaleString()} events · confidence ${Math.round(analysis.modelConfidence * 100)}%`;
  panelIntro.textContent = analysis.dataCoverage.events
    ? `Based on the exact pitch, match context, and ${analysis.dataCoverage.events.toLocaleString()} training events across ${analysis.dataCoverage.matches} matches.`
    : 'Local tactical baseline · no historical training events are loaded.';
  document.querySelector('#undoButton').disabled = !history.past.length;
  document.querySelector('#redoButton').disabled = !history.future.length;
}

function renderMarkers() {
  markerLayer.replaceChildren();
  state.players.forEach((player) => markerLayer.appendChild(createMarker(player, 'player')));
  markerLayer.appendChild(createMarker({ ...state.ball, id: 'ball' }, 'ball'));
  (state.annotations || []).forEach((annotation) => {
    if (!Number.isFinite(annotation.x) || !Number.isFinite(annotation.y)) return;
    const pin = document.createElement('span');
    pin.className = 'annotation-pin';
    pin.style.left = `${annotation.x * 100}%`;
    pin.style.top = `${annotation.y * 100}%`;
    pin.textContent = '✎';
    pin.title = annotation.text;
    pin.setAttribute('aria-label', `Analyst annotation: ${annotation.text}`);
    markerLayer.appendChild(pin);
  });
  const homeCount = state.players.filter((player) => (player.team || 'home') === 'home').length;
  const awayCount = state.players.filter((player) => player.team === 'away').length;
  markerCount.textContent = `${state.homeTeam || 'Home team'} ${homeCount}/${MAX_PLAYERS_PER_TEAM} · ${state.awayTeam || 'Away team'} ${awayCount}/${MAX_PLAYERS_PER_TEAM}`;
}

function createMarker(marker, type) {
  const element = document.createElement('button');
  element.type = 'button';
  element.className = type === 'ball' ? 'ball-marker' : marker.team === 'away' ? 'player-marker opponent-marker' : 'player-marker';
  element.dataset.markerId = marker.id;
  element.dataset.markerType = type;
  element.dataset.team = marker.team || 'home';
  element.style.left = `${marker.x * 100}%`;
  element.style.top = `${marker.y * 100}%`;
  if (type === 'player') element.textContent = marker.number;
  element.setAttribute('aria-label', markerAriaLabel(marker, type, state));
  element.title = markerAriaLabel(marker, type, state);
  return element;
}

function renderOverlays() {
  const width = pitch.clientWidth || 700;
  const height = pitch.clientHeight || 425;
  pitchOverlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
  let markup = '';
  if (overlays.heatmap) {
    for (const cell of analysis.heatmaps.pressure.cells) {
      const alpha = cell.value * 0.45;
      markup += `<rect x="${(cell.col / 12) * width}" y="${(cell.row / 8) * height}" width="${width / 12}" height="${height / 8}" fill="rgba(249,115,22,${alpha})" />`;
    }
  }
  if (overlays.lanes) {
    for (const lane of getPassingLanes(state)) {
      markup += `<line x1="${lane.from.x * width}" y1="${lane.from.y * height}" x2="${lane.to.x * width}" y2="${lane.to.y * height}" stroke="${lane.blocked ? '#f97316' : '#2563eb'}" stroke-width="2" stroke-dasharray="${lane.blocked ? '6 5' : '0'}" />`;
    }
  }
  pitchOverlay.innerHTML = markup;
  const shape = getTeamShape(state);
  defensiveLine.hidden = !overlays.shape;
  defensiveLine.style.left = `${shape.defensiveLine * 100}%`;
}

function renderRecommendations(result) {
  picks.innerHTML = `<span>Safest <b>${escapeHtml(result.picks.safest.label)}</b></span><span>Highest upside <b>${escapeHtml(result.picks.highestUpside.label)}</b></span><span>Best balance <b>${escapeHtml(result.picks.bestBalance.label)}</b></span>`;
  recommendations.replaceChildren(...result.recommendations.map((recommendation, index) => {
    const article = document.createElement('article');
    article.className = `recommendation${index === 0 ? ' featured' : ''}`;
    article.dataset.playId = recommendation.id;
    article.tabIndex = 0;
    const confidenceClass = recommendation.confidence === 'Good option' ? ' medium' : recommendation.confidence === 'Situational' ? ' low' : '';
    article.innerHTML = `<div class="rec-top"><span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="confidence${confidenceClass}">${escapeHtml(recommendation.confidence)}</span></div><div class="rec-title-row"><div><h3>${escapeHtml(recommendation.label)}</h3><p>${escapeHtml(recommendation.detail)}</p></div><strong class="probability">${Math.round(recommendation.probability * 100)}<small>%</small></strong></div><div class="probability-bar"><span style="width: ${recommendation.probability * 100}%"></span></div><div class="rec-reason"><strong>Why it fits</strong><span>${escapeHtml(recommendation.why)}</span><strong>Watch for</strong><span>${escapeHtml(recommendation.failureRisk)}</span></div><div class="rec-footer"><span>Shot creation <b>${Math.round(recommendation.shotCreation * 100)}%</b></span><span>Turnover <b>${Math.round(recommendation.turnoverRisk * 100)}%</b></span><span>Territory <b>+${recommendation.territoryGain}m</b></span></div><span class="rec-action">View exact pitch →</span>`;
    return article;
  }));
  insightText.textContent = result.insight;
  const historical = result.historical.historicalOutcome
    ? `Illustrative historical reference in ${result.historical.league}: ${result.historical.historicalOutcome}.`
    : `No historical reference is available for ${result.historical.league}.`;
  influenceText.textContent = `Inputs: ${result.influence.features.map((item) => item.name).join(', ')}. ${historical} Coverage ${result.dataCoverage.competition}.`;
  panelIntro.textContent = result.dataCoverage.events
    ? `Based on the exact pitch and match context, with ${result.dataCoverage.events.toLocaleString()} training events across ${result.dataCoverage.matches} matches.`
    : 'Based on the exact pitch and match context. No historical training data is loaded.';
}

function setTool(tool) {
  activeTool = tool;
  toolButtons.forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
  hint.textContent = tool === 'ball' ? 'Click or drag to move the ball' : tool === 'erase' ? 'Drag the brush across players to erase' : tool === 'opponent' ? `Click anywhere to add a ${state.awayTeam || 'opponent'} player` : tool === 'annotation' ? 'Click the pitch to add an analyst note' : `Click anywhere to add a ${state.homeTeam || 'home team'} player`;
  eraseBrush.hidden = tool !== 'erase';
}

function pitchPosition(event) {
  const bounds = pitch.getBoundingClientRect();
  return { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
}

function updateEraseBrush(event) {
  const bounds = pitch.getBoundingClientRect();
  eraseBrush.style.left = `${event.clientX - bounds.left}px`;
  eraseBrush.style.top = `${event.clientY - bounds.top}px`;
}

function eraseAt(event) {
  const { x, y } = pitchPosition(event);
  const before = state.players.length;
  const next = { ...state, players: state.players.filter((player) => Math.hypot(player.x - x, player.y - y) > 0.065) };
  if (next.players.length !== before) {
    commitState(next);
    hint.textContent = `${before - next.players.length} player${before - next.players.length === 1 ? '' : 's'} erased`;
  }
}

function handlePitchClick(event) {
  if (ignoreClick) { ignoreClick = false; return; }
  if (drag || activeTool === 'erase') return;
  if (event.target.closest('[data-marker-id]')) return;
  const position = pitchPosition(event);
  if (activeTool === 'annotation') {
    const note = createAnnotation(window.prompt('Analyst annotation'), position);
    if (note) commitState({ ...state, annotations: [...(state.annotations || []), note] });
    return;
  }
  if (activeTool === 'ball') {
    commitState({ ...state, ball: { ...state.ball, ...position } });
    hint.textContent = 'Ball position updated';
    return;
  }
  const team = activeTool === 'opponent' ? 'away' : 'home';
  const teamPlayers = state.players.filter((player) => (player.team || 'home') === team);
  if (teamPlayers.length >= MAX_PLAYERS_PER_TEAM) {
    hint.textContent = `Maximum ${MAX_PLAYERS_PER_TEAM} ${team === 'away' ? 'opponent' : 'home'} players reached`;
    return;
  }
  const number = teamPlayers.length ? Math.max(...teamPlayers.map((player) => player.number || 0)) + 1 : 1;
  commitState({ ...state, players: [...state.players, { id: `player-${Date.now()}`, number, team, ...position }] });
  hint.textContent = `${team === 'away' ? state.awayTeam : state.homeTeam} player ${number} placed`;
}

function startDrag(event) {
  const marker = event.target.closest('[data-marker-id]');
  if (!marker || activeTool === 'erase') return;
  event.preventDefault();
  drag = { id: marker.dataset.markerId, type: marker.dataset.markerType, pointerId: event.pointerId };
  pitch.setPointerCapture(event.pointerId);
}

function moveDrag(event) {
  if (!drag) return;
  const position = pitchPosition(event);
  if (drag.type === 'ball') state = { ...state, ball: { ...state.ball, ...position } };
  else state = { ...state, players: state.players.map((player) => player.id === drag.id ? { ...player, ...position } : player) };
  renderMarkers();
  renderOverlays();
}

function endDrag() {
  if (!drag) return;
  ignoreClick = true;
  drag = null;
  history = pushHistory(history, state);
  render();
  scheduleAutosave();
}

function analyse() {
  setLoading(true);
  analyseButton.disabled = true;
  analyseButton.innerHTML = '<span class="spark">✦</span> Reading the shape...';
  window.setTimeout(() => {
    const result = analyzeScenario(state, model);
    renderRecommendations(result);
    if (authenticated) apiRequest('/api/analysis/completed', { method: 'POST', body: { scenarioName: state.name, recommendation: result.recommendations[0]?.label } });
    analyseButton.innerHTML = '<span class="spark">✦</span> Analyse next plays <span class="arrow">→</span>';
    analyseButton.disabled = false;
    setLoading(false);
    document.querySelector('.recommendations-panel').animate([{ transform: 'translateY(4px)', opacity: .6 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 350, easing: 'ease-out' });
  }, 280);
}

function openAnimation(playId) {
  const animation = getPlayAnimation(playId, state);
  timeline = buildPlayTimeline(state, playId);
  animationTitle.textContent = animation.title;
  animationExplanation.textContent = animation.explanation;
  animationSteps.replaceChildren(...animation.phases.map((phase, index) => {
    const step = document.createElement('li');
    step.innerHTML = `<span>${index + 1}</span><strong>${phase}</strong>`;
    return step;
  }));
  renderAnimationFrame(0);
  animationDialog.showModal();
  replayAnimation();
}

function renderAnimationFrame(time) {
  const frame = interpolateTimeline(timeline, time);
  animationPitch.innerHTML = '<div class="pitch-line halfway"></div><div class="pitch-circle"></div><div class="pitch-spot"></div><div class="penalty-box left-box"></div><div class="goal left-goal"></div><div class="six-yard left-six"></div><div class="penalty-box right-box"></div><div class="goal right-goal"></div><div class="six-yard right-six"></div><svg class="pitch-overlay" id="animationOverlay"></svg><div id="animationMarkers"></div>';
  const markers = animationPitch.querySelector('#animationMarkers');
  frame.players.forEach((player) => markers.appendChild(createAnimationMarker(player, 'player')));
  markers.appendChild(createAnimationMarker({ ...frame.ball, id: 'ball' }, 'ball'));
  const overlay = animationPitch.querySelector('#animationOverlay');
  const width = animationPitch.clientWidth || 480;
  const height = animationPitch.clientHeight || 285;
  overlay.setAttribute('viewBox', `0 0 ${width} ${height}`);
  overlay.innerHTML = timeline.lanes.map((lane) => `<line x1="${lane.from.x * width}" y1="${lane.from.y * height}" x2="${lane.to.x * width}" y2="${lane.to.y * height}" stroke="${lane.blocked ? '#f97316' : '#93c5fd'}" stroke-width="2" stroke-dasharray="${lane.blocked ? '5 4' : '0'}" />`).join('');
  timelineScrubber.value = String(Math.round(time * 100));
}

function replayAnimation() {
  window.cancelAnimationFrame(animationFrame);
  const started = performance.now();
  const duration = 2200 / Number(animationSpeed.value || 1);
  const tick = (now) => {
    const time = Math.min(1, (now - started) / duration);
    renderAnimationFrame(time);
    if (time < 1 && animationDialog.open) animationFrame = window.requestAnimationFrame(tick);
  };
  animationFrame = window.requestAnimationFrame(tick);
}

function createAnimationMarker(marker, type) {
  const element = document.createElement('div');
  element.className = type === 'ball' ? 'animation-ball' : marker.team === 'away' ? 'animation-player animation-opponent' : 'animation-player';
  element.style.left = `${marker.x * 100}%`;
  element.style.top = `${marker.y * 100}%`;
  if (type === 'player') element.textContent = marker.number;
  element.setAttribute('aria-label', markerAriaLabel(marker, type, state));
  return element;
}

async function saveScenario() {
  const scenarios = readSavedScenarios();
  const savedAt = new Date().toISOString();
  const previous = scenarios.find((item) => item.id === selectedScenarioId);
  const scenario = { id: selectedScenarioId || `scenario-${Date.now()}`, name: state.name || `Scenario ${scenarios.length + 1}`, notes: state.notes, savedAt, owner: account.email, state: structuredClone(state), versions: appendVersion(previous?.versions || [], state, savedAt) };
  setLoading(true);
  if (authenticated) {
    const route = selectedScenarioId && !String(selectedScenarioId).startsWith('scenario-') ? `/api/scenarios/${selectedScenarioId}` : '/api/scenarios';
    const remote = await apiRequest(route, { method: selectedScenarioId && !String(selectedScenarioId).startsWith('scenario-') ? 'PUT' : 'POST', body: { name: scenario.name, notes: scenario.notes, state: scenario.state } });
    if (remote.ok) {
      scenario.id = remote.data.id;
      selectedScenarioId = remote.data.id;
    } else showError(remote.data?.error || 'Could not save to the server. Stored locally instead.');
  }
  const next = [scenario, ...scenarios.filter((item) => item.id !== scenario.id)].slice(0, 20);
  writeSavedScenarios(next);
  setLoading(false);
  render();
  saveButton.textContent = 'Saved';
  window.setTimeout(() => { saveButton.textContent = 'Save scenario'; }, 1200);
}

async function openSavedScenarios(event) {
  event?.preventDefault();
  await refreshScenarios();
  renderSavedList();
  savedPanel.showModal();
}

function renderSavedList() {
  const scenarios = readSavedScenarios();
  savedList.replaceChildren(...(scenarios.length ? scenarios.map((scenario) => {
    const item = document.createElement('li');
    item.innerHTML = `<div><strong>${escapeHtml(scenario.name)}</strong><small>${new Date(scenario.savedAt).toLocaleString()}</small></div><span><button class="load-scenario" data-id="${scenario.id}">Load</button><button class="history-scenario" data-id="${scenario.id}">History</button><button class="share-scenario" data-id="${scenario.id}">Share</button><button class="delete-scenario" data-id="${scenario.id}" aria-label="Delete ${escapeHtml(scenario.name)}">×</button></span>`;
    return item;
  }) : [Object.assign(document.createElement('li'), { className: 'empty-state', textContent: 'No saved scenarios yet.' })]));
}

async function handleSavedListClick(event) {
  const id = event.target.dataset.id;
  if (!id) return;
  const scenarios = readSavedScenarios();
  if (event.target.classList.contains('load-scenario')) {
    const selected = scenarios.find((scenario) => scenario.id === id);
    if (selected) {
      selectedScenarioId = selected.id;
      commitState(selected.state);
      hint.textContent = `${selected.name} loaded`;
      commentForm.hidden = !authenticated;
      await loadComments(id);
    }
  } else if (event.target.classList.contains('history-scenario')) {
    const selected = scenarios.find((scenario) => scenario.id === id);
    let versions = selected?.versions || [];
    if (authenticated && !String(id).startsWith('scenario-')) {
      const response = await apiRequest(`/api/scenarios/${id}/versions`);
      if (response.ok) versions = response.data;
    }
    const historyOutput = document.querySelector('#historyOutput');
    if (!versions.length) historyOutput.textContent = 'No saved versions yet. Save this scenario again after making a change.';
    else if (versions.length < 2) historyOutput.textContent = `1 version saved · ${new Date(versions[0].savedAt).toLocaleString()}`;
    else {
      const comparison = compareVersions(versions[0].state, versions[1].state, (value) => analyzeScenario(value, model));
      historyOutput.textContent = `${versions.length} versions saved\nLatest: ${new Date(versions[0].savedAt).toLocaleString()}\nPrevious: ${new Date(versions[1].savedAt).toLocaleString()}\nTop recommendation changed: ${comparison.topPlayChanged ? 'Yes' : 'No'}\nTop recommendation probability change: ${Math.round(comparison.probabilityDelta * 100)} points`;
    }
  } else if (event.target.classList.contains('delete-scenario')) {
    if (authenticated) await apiRequest(`/api/scenarios/${id}`, { method: 'DELETE' });
    writeSavedScenarios(scenarios.filter((scenario) => scenario.id !== id));
    renderSavedList();
    renderSavedCount();
  } else if (event.target.classList.contains('share-scenario')) {
    const share = await apiRequest(`/api/scenarios/${id}/share`, { method: 'POST', body: { permission: 'viewer' } });
    if (share.ok) {
      await navigator.clipboard?.writeText(`${window.location.origin}/?share=${share.data.token}`);
      hint.textContent = 'Share link copied';
    } else showError(share.data?.error || 'Sign in to create a share link.');
  }
}

async function loadComments(id) {
  if (!authenticated) return;
  const response = await apiRequest(`/api/scenarios/${id}/comments`);
  commentList.replaceChildren(...(response.ok ? response.data.map((comment) => Object.assign(document.createElement('li'), { innerHTML: `<div><strong>${escapeHtml(comment.author)}</strong><small>${escapeHtml(comment.body)}</small></div>` })) : []));
}

function renderAccount() {
  profileName.textContent = authenticated ? account.name : 'Guest';
  profileType.textContent = authenticated ? account.email : 'Guest session';
  accountNameInput.value = authenticated ? account.name : '';
  accountEmailInput.value = authenticated ? account.email : '';
  logoutButton.hidden = !authenticated;
  document.querySelector('#deleteAccountButton').hidden = !authenticated;
  document.querySelector('#verifyButton').hidden = !authenticated || account.emailVerified;
  authStatus.textContent = authenticated ? `Signed in as ${account.name}` : 'Guest mode';
  authStatus.classList.toggle('guest', !authenticated);
  authStatus.classList.toggle('signed-in', authenticated);
  accountTitle.textContent = authenticated ? 'Your account' : authMode === 'login' ? 'Log in to Playmaker' : authMode === 'register' ? 'Create your Playmaker account' : 'Reset your password';
  guestStatus.hidden = authenticated;
  accountStatus.textContent = authenticated ? (account.emailVerified ? 'Account connected.' : 'Verify your email to finish setup.') : '';
}

async function saveAccount(event) {
  event.preventDefault();
  const email = accountEmailInput.value.trim();
  const password = accountPasswordInput.value;
  if (authMode === 'forgot') {
    if (document.querySelector('#resetToken').value) {
      const reset = await apiRequest('/api/auth/reset-password', { method: 'POST', body: { token: document.querySelector('#resetToken').value, password } });
      accountStatus.textContent = reset.ok ? 'Password updated. You are signed in.' : reset.data?.error || 'Reset failed.';
      if (reset.ok) { account = reset.data; authenticated = true; await refreshScenarios(); render(); accountPanel.close(); }
      return;
    }
    const forgot = await apiRequest('/api/auth/forgot-password', { method: 'POST', body: { email } });
    accountStatus.textContent = forgot.ok ? (forgot.data?.resetToken ? `Development reset token: ${forgot.data.resetToken}` : forgot.data?.delivery === 'configured' ? 'If the account exists, a reset email will be sent.' : 'Reset request recorded. Email delivery is not configured for this deployment.') : 'Could not start a reset.';
    if (forgot.data?.resetToken) document.querySelector('#resetToken').value = forgot.data.resetToken;
    document.querySelector('#resetTokenField').hidden = false;
    document.querySelector('#accountPasswordField').hidden = false;
    return;
  }
  const body = authMode === 'register' ? { name: accountNameInput.value.trim(), email, password } : { email, password };
  accountStatus.textContent = authMode === 'register' ? 'Creating account...' : 'Logging in...';
  const response = await apiRequest(authMode === 'register' ? '/api/auth/register' : '/api/auth/login', { method: 'POST', body });
  if (!response.ok) {
    accountStatus.textContent = response.status === 0 || response.status === 501 ? 'The API is unavailable on this page. Open the URL printed by npm start.' : response.data?.error || 'Could not authenticate. Check your details.';
    return;
  }
  account = response.data;
  authenticated = true;
  accountPasswordInput.value = '';
  await refreshScenarios();
  render();
  renderAccount();
  if (authMode === 'register' && !account.emailVerified) {
    if (response.data.verificationToken) {
      document.querySelector('#verificationToken').value = response.data.verificationToken;
      document.querySelector('#verificationTokenField').hidden = false;
      document.querySelector('#completeVerificationButton').hidden = false;
      accountStatus.textContent = 'Development verification token generated. Paste it below to verify.';
    } else if (response.data.emailDelivery === 'configured') accountStatus.textContent = 'Verification email sent.';
    else accountStatus.textContent = 'Email delivery is not configured for this deployment.';
  } else accountPanel.close();
}

function readAccount() {
  return { name: 'Guest', email: 'Guest session' };
}

function setAuthMode(mode) {
  authMode = mode;
  loginMode.classList.toggle('active', mode === 'login');
  registerMode.classList.toggle('active', mode === 'register');
  document.querySelector('#forgotMode').classList.toggle('active', mode === 'forgot');
  accountNameField.hidden = mode !== 'register';
  accountNameInput.required = mode === 'register';
  document.querySelector('#accountPasswordField').hidden = false;
  document.querySelector('#resetTokenField').hidden = mode !== 'forgot';
  accountPasswordInput.required = mode !== 'forgot';
  accountPasswordInput.autocomplete = mode === 'register' ? 'new-password' : 'current-password';
  accountSubmit.innerHTML = `${mode === 'register' ? 'Create account' : mode === 'forgot' ? 'Send reset' : 'Log in'} <span class="arrow">→</span>`;
  renderAccount();
}

async function refreshScenarios() {
  if (!authenticated) return;
  const response = await apiRequest('/api/scenarios');
  if (response.ok) writeSavedScenarios(response.data.map((scenario) => ({ ...scenario, owner: account.email })));
}

async function apiRequest(route, options = {}) {
  try {
    const response = await fetch(route, { credentials: 'same-origin', ...options, headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...(options.headers || {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
    const content = response.status === 204 ? '' : await response.text();
    let data = null;
    try { data = content ? JSON.parse(content) : null; } catch { data = null; }
    return { ok: response.ok, status: response.status, data };
  } catch { return { ok: false, status: 0, data: null }; }
}

function readSavedScenarios() {
  return readJson(localStorage, STORAGE_KEY, []);
}

function writeSavedScenarios(scenarios) {
  writeJson(localStorage, STORAGE_KEY, scenarios);
}

function scheduleAutosave() {
  window.clearTimeout(autosaveTimer);
  autosaveTimer = window.setTimeout(() => writeJson(localStorage, DRAFT_KEY, state), 400);
}

function showError(message) {
  errorText.textContent = message;
  errorBanner.hidden = false;
}

function setLoading(visible) {
  loadingVeil.hidden = !visible;
}

function populateFormations() {
  const options = Object.keys(FORMATIONS).map((name) => `<option value="${name}">${name}</option>`).join('');
  homeFormation.innerHTML = options;
  awayFormation.innerHTML = options;
}

function populateShortcuts() {
  document.querySelector('#shortcutList').innerHTML = SHORTCUTS.map((item) => `<p><kbd>${item.keys.join('+')}</kbd> ${item.action}</p>`).join('');
}

function exportScenario() {
  const report = buildTacticalReport(state, model);
  const svg = buildPitchSvg(state);
  const filename = state.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase() || 'scenario';
  downloadFile(`${filename}-report.md`, report.text, 'text/markdown');
  downloadFile(`${filename}-pitch.svg`, svg, 'image/svg+xml');
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function handleShortcut(event) {
  if (event.target.matches('input, textarea, select')) return;
  if (shortcutMatches(event, { keys: ['Mod', 'Z'] })) { event.preventDefault(); history = undoHistory(history); state = history.present; render(); }
  if (shortcutMatches(event, { keys: ['Mod', 'Shift', 'Z'] })) { event.preventDefault(); history = redoHistory(history); state = history.present; render(); }
  if (shortcutMatches(event, { keys: ['Mod', 'S'] })) { event.preventDefault(); saveScenario(); }
  if (shortcutMatches(event, { keys: ['Mod', 'D'] })) { event.preventDefault(); duplicateCurrent(); }
  if (shortcutMatches(event, { keys: ['Space'] })) { event.preventDefault(); analyse(); }
  if (shortcutMatches(event, { keys: ['1'] })) setTool('player');
  if (shortcutMatches(event, { keys: ['2'] })) setTool('opponent');
  if (shortcutMatches(event, { keys: ['3'] })) setTool('ball');
  if (shortcutMatches(event, { keys: ['4'] })) setTool('erase');
  if (shortcutMatches(event, { keys: ['L'] })) toggleOverlay('lanes');
  if (shortcutMatches(event, { keys: ['H'] })) toggleOverlay('heatmap');
  if (shortcutMatches(event, { keys: ['R'] })) { if (timeline) replayAnimation(); }
  if (shortcutMatches(event, { keys: ['?'] })) document.querySelector('#helpPanel').showModal();
}

function toggleOverlay(name) {
  overlays[name] = !overlays[name];
  overlayButtons.forEach((button) => button.setAttribute('aria-pressed', String(overlays[button.dataset.overlay])));
  renderOverlays();
}

function duplicateCurrent() {
  const copy = duplicateScenario({ id: selectedScenarioId || 'local', name: state.name, state });
  state = { ...copy.state, name: copy.name };
  selectedScenarioId = null;
  history = createHistory(state);
  render();
  hint.textContent = 'Scenario duplicated locally';
}

function clamp(value) { return Math.max(0, Math.min(1, value)); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function applyTheme(theme) { document.documentElement.dataset.theme = theme; themeButton.innerHTML = `${theme === 'dark' ? '☼' : '◐'} <span>${theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>`; }

populateFormations();
populateShortcuts();
toolButtons.forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool)));
overlayButtons.forEach((button) => button.addEventListener('click', () => toggleOverlay(button.dataset.overlay)));
pitch.addEventListener('click', handlePitchClick);
pitch.addEventListener('pointerdown', (event) => {
  if (activeTool === 'erase') { isErasing = true; pitch.setPointerCapture(event.pointerId); updateEraseBrush(event); eraseAt(event); return; }
  startDrag(event);
});
pitch.addEventListener('pointermove', (event) => {
  if (activeTool === 'erase') { updateEraseBrush(event); if (isErasing) eraseAt(event); return; }
  moveDrag(event);
});
pitch.addEventListener('pointerup', () => { isErasing = false; endDrag(); });
pitch.addEventListener('pointerleave', () => { if (!isErasing) eraseBrush.hidden = true; });
pitch.addEventListener('pointerenter', (event) => { if (activeTool === 'erase') { eraseBrush.hidden = false; updateEraseBrush(event); } });
recommendations.addEventListener('click', (event) => { const card = event.target.closest('[data-play-id]'); if (card) openAnimation(card.dataset.playId); });
recommendations.addEventListener('keydown', (event) => { if (event.key === 'Enter') event.target.closest('[data-play-id]')?.click(); });
analyseButton.addEventListener('click', analyse);
resetButton.addEventListener('click', () => { selectedScenarioId = null; commitState(createDefaultScenario()); setTool('player'); history = createHistory(state); });
saveButton.addEventListener('click', saveScenario);
document.querySelector('#duplicateButton').addEventListener('click', duplicateCurrent);
document.querySelector('#exportButton').addEventListener('click', exportScenario);
document.querySelector('#undoButton').addEventListener('click', () => { history = undoHistory(history); state = history.present; render(); });
document.querySelector('#redoButton').addEventListener('click', () => { history = redoHistory(history); state = history.present; render(); });
savedNav.addEventListener('click', openSavedScenarios);
savedList.addEventListener('click', handleSavedListClick);
savedClose.addEventListener('click', () => savedPanel.close());
accountButton.addEventListener('click', () => accountPanel.showModal());
accountClose.addEventListener('click', () => accountPanel.close());
accountForm.addEventListener('submit', saveAccount);
document.querySelector('#settingsNav').addEventListener('click', () => accountPanel.showModal());
document.querySelector('#modelsNav').addEventListener('click', async (event) => {
  event.preventDefault();
  const dashboard = await apiRequest('/api/model');
  document.querySelector('#modelDashboard').textContent = dashboard.ok ? JSON.stringify({ ...dashboard.data, local: analyzeScenario(state, model).dataCoverage, historical: analysis.historical }, null, 2) : 'Model API unavailable. Local coverage is still shown in the insight panel.';
  document.querySelector('#modelPanel').showModal();
});
document.querySelector('#modelClose').addEventListener('click', () => document.querySelector('#modelPanel').close());
document.querySelector('#compareNav').addEventListener('click', (event) => {
  event.preventDefault();
  const options = readSavedScenarios().map((scenario) => `<option value="${scenario.id}">${escapeHtml(scenario.name)}</option>`).join('') || '<option>Save a scenario first</option>';
  document.querySelector('#compareLeft').innerHTML = options;
  document.querySelector('#compareRight').innerHTML = options;
  document.querySelector('#comparePanel').showModal();
});
document.querySelector('#compareClose').addEventListener('click', () => document.querySelector('#comparePanel').close());
document.querySelector('#runCompare').addEventListener('click', () => {
  const scenarios = readSavedScenarios();
  const left = scenarios.find((item) => item.id === document.querySelector('#compareLeft').value)?.state || state;
  const right = scenarios.find((item) => item.id === document.querySelector('#compareRight').value)?.state || state;
  const result = compareScenarios(left, right, model);
  const leftName = scenarios.find((item) => item.id === document.querySelector('#compareLeft').value)?.name || 'Current';
  const rightName = scenarios.find((item) => item.id === document.querySelector('#compareRight').value)?.name || 'Current';
  const summarize = (name, analysisResult) => `${name}\n${analysisResult.recommendations.map((play) => `  ${play.label}: ${Math.round(play.probability * 100)}% · turnover ${Math.round(play.turnoverRisk * 100)}% · shot ${Math.round(play.shotCreation * 100)}%`).join('\n')}`;
  document.querySelector('#compareOutput').textContent = `${summarize(leftName, result.left)}\n\n${summarize(rightName, result.right)}\n\nProbability change (right vs left)\n${result.deltas.map((delta) => `${delta.label}: ${delta.probability >= 0 ? '+' : ''}${Math.round(delta.probability * 100)} pts`).join('\n')}`;
});
document.querySelector('#notifyNav').addEventListener('click', async () => {
  const response = await apiRequest('/api/notifications');
  document.querySelector('#notifyList').replaceChildren(...(response.ok && response.data.length ? response.data.map((item) => Object.assign(document.createElement('li'), { innerHTML: `<div><strong>${escapeHtml(item.kind)}</strong><small>${escapeHtml(item.message)}</small></div>` })) : [Object.assign(document.createElement('li'), { className: 'empty-state', textContent: 'No notifications yet.' })]));
  document.querySelector('#notifyCount').textContent = String(response.ok ? response.data.filter((item) => !item.readAt).length : 0);
  document.querySelector('#notifyPanel').showModal();
  if (response.ok) apiRequest('/api/notifications/read', { method: 'POST' });
});
document.querySelector('#notifyClose').addEventListener('click', () => document.querySelector('#notifyPanel').close());
document.querySelector('#helpButton').addEventListener('click', () => document.querySelector('#helpPanel').showModal());
document.querySelector('#helpClose').addEventListener('click', () => document.querySelector('#helpPanel').close());
riskInput.addEventListener('input', () => { state = { ...state, risk: Number(riskInput.value) }; riskValue.textContent = `${state.risk}%`; });
riskInput.addEventListener('change', () => commitState({ ...state, risk: Number(riskInput.value) }));
gameStateInput.addEventListener('change', () => commitState({ ...state, gameState: gameStateInput.value }));
mentalityInput.addEventListener('change', () => commitState({ ...state, mentality: mentalityInput.value }));
themeButton.addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(THEME_KEY, theme); applyTheme(theme); });
animationClose.addEventListener('click', () => { window.cancelAnimationFrame(animationFrame); animationDialog.close(); });
document.querySelector('#replayButton').addEventListener('click', replayAnimation);
timelineScrubber.addEventListener('input', () => { if (timeline) renderAnimationFrame(Number(timelineScrubber.value) / 100); });
document.querySelector('#feedbackForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const response = await apiRequest('/api/model/feedback', { method: 'POST', body: { predicted: document.querySelector('#predictedPlay').value, actual: document.querySelector('#actualPlay').value, features: analysis.inputFeatures } });
  document.querySelector('#modelDashboard').textContent = response.ok ? JSON.stringify(response.data, null, 2) : response.data?.error || 'Sign in to send feedback.';
});
commentForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!selectedScenarioId) return;
  await apiRequest(`/api/scenarios/${selectedScenarioId}/comments`, { method: 'POST', body: { body: document.querySelector('#commentBody').value } });
  document.querySelector('#commentBody').value = '';
  await loadComments(selectedScenarioId);
});
logoutButton.addEventListener('click', async () => {
  await apiRequest('/api/auth/logout', { method: 'POST' });
  authenticated = false;
  account = readAccount();
  localStorage.removeItem(STORAGE_KEY);
  accountPasswordInput.value = '';
  setAuthMode('login');
  render();
  accountStatus.textContent = 'Signed out. You are now browsing as a guest.';
  accountPanel.close();
});
document.querySelector('#deleteAccountButton').addEventListener('click', async () => {
  const password = accountPasswordInput.value;
  const response = await apiRequest('/api/me', { method: 'DELETE', body: { password } });
  accountStatus.textContent = response.ok ? 'Account deleted.' : 'Enter your password to delete the account.';
  if (response.ok) { authenticated = false; account = readAccount(); render(); }
});
document.querySelector('#verifyButton').addEventListener('click', async () => {
  const response = await apiRequest('/api/auth/resend-verification', { method: 'POST' });
  accountStatus.textContent = response.ok ? (response.data?.verificationToken ? 'Development verification token generated. Paste it below to verify.' : response.data?.delivery === 'configured' ? 'Verification email sent.' : 'Verification token refreshed, but email delivery is not configured for this deployment.') : 'Could not resend verification.';
  if (response.data?.verificationToken) {
    document.querySelector('#verificationToken').value = response.data.verificationToken;
    document.querySelector('#verificationTokenField').hidden = false;
    document.querySelector('#completeVerificationButton').hidden = false;
  }
});
document.querySelector('#completeVerificationButton').addEventListener('click', async () => {
  const token = document.querySelector('#verificationToken').value.trim();
  const response = await apiRequest('/api/auth/verify-email', { method: 'POST', body: { token } });
  accountStatus.textContent = response.ok ? 'Email verified.' : response.data?.error || 'Could not verify email.';
  if (response.ok) { account.emailVerified = true; renderAccount(); accountStatus.textContent = 'Email verified.'; }
});
loginMode.addEventListener('click', () => setAuthMode('login'));
registerMode.addEventListener('click', () => setAuthMode('register'));
document.querySelector('#forgotMode').addEventListener('click', () => setAuthMode('forgot'));
scenarioNameInput.addEventListener('change', () => commitState({ ...state, name: scenarioNameInput.value }));
notesInput.addEventListener('change', () => commitState({ ...state, notes: notesInput.value }));
homeTeamInput.addEventListener('change', () => commitState({ ...state, homeTeam: homeTeamInput.value }));
awayTeamInput.addEventListener('change', () => commitState({ ...state, awayTeam: awayTeamInput.value }));
minuteInput.addEventListener('change', () => commitState({ ...state, minute: Math.max(0, Math.min(120, Number(minuteInput.value) || 0)) }));
homeScoreInput.addEventListener('change', () => commitState({ ...state, score: { ...state.score, home: Number(homeScoreInput.value) || 0 } }));
awayScoreInput.addEventListener('change', () => commitState({ ...state, score: { ...state.score, away: Number(awayScoreInput.value) || 0 } }));
possessionInput.addEventListener('change', () => commitState({ ...state, possession: possessionInput.value }));
leagueInput.addEventListener('change', () => commitState({ ...state, league: leagueInput.value }));
competitionInput.addEventListener('change', () => commitState({ ...state, competition: competitionInput.value }));
document.querySelector('#homeYellowInput').addEventListener('change', (event) => commitState({ ...state, cards: { ...state.cards, homeYellow: Number(event.target.value) || 0 } }));
document.querySelector('#homeRedInput').addEventListener('change', (event) => commitState({ ...state, cards: { ...state.cards, homeRed: Number(event.target.value) || 0 } }));
document.querySelector('#awayYellowInput').addEventListener('change', (event) => commitState({ ...state, cards: { ...state.cards, awayYellow: Number(event.target.value) || 0 } }));
document.querySelector('#awayRedInput').addEventListener('change', (event) => commitState({ ...state, cards: { ...state.cards, awayRed: Number(event.target.value) || 0 } }));
document.querySelector('#homeSubsInput').addEventListener('change', (event) => commitState({ ...state, substitutions: { ...state.substitutions, home: Number(event.target.value) || 0 } }));
document.querySelector('#awaySubsInput').addEventListener('change', (event) => commitState({ ...state, substitutions: { ...state.substitutions, away: Number(event.target.value) || 0 } }));
homeFormation.addEventListener('change', () => commitState(applyFormation(state, 'home', homeFormation.value)));
awayFormation.addEventListener('change', () => commitState(applyFormation(state, 'away', awayFormation.value)));
document.querySelector('#errorDismiss').addEventListener('click', () => { errorBanner.hidden = true; });
document.querySelector('#onboardingButton').addEventListener('click', () => {
  commitState(createOnboardingScenario());
  history = createHistory(state);
  onboardingBanner.hidden = true;
  writeJson(localStorage, ONBOARDING_KEY, true);
});
document.querySelector('#onboardingDismiss').addEventListener('click', () => {
  onboardingBanner.hidden = true;
  writeJson(localStorage, ONBOARDING_KEY, true);
});
document.addEventListener('keydown', handleShortcut);
window.addEventListener('resize', renderOverlays);

savedCount.textContent = String(Math.min(readSavedScenarios().length, 20));
eraseBrush.hidden = true;
onboardingBanner.hidden = Boolean(readJson(localStorage, ONBOARDING_KEY, false));
render();
setAuthMode('login');
applyTheme(localStorage.getItem(THEME_KEY) || 'light');
loadModel();
restoreSession();
restoreShare();

async function loadModel() {
  try {
    const response = await fetch('./model/model.json', { cache: 'no-store' });
    if (!response.ok) return;
    model = await response.json();
    render();
  } catch { /* The deterministic tactical baseline keeps the app usable offline. */ }
}

async function restoreSession() {
  const response = await apiRequest('/api/me');
  if (response.ok) {
    account = response.data;
    authenticated = true;
    await refreshScenarios();
    const notifications = await apiRequest('/api/notifications');
    if (notifications.ok) document.querySelector('#notifyCount').textContent = String(notifications.data.filter((item) => !item.readAt).length);
    render();
  }
}

async function restoreShare() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get('share');
  if (!token) return;
  const response = await apiRequest(`/api/share/${token}`);
  if (response.ok) {
    commitState(response.data.state);
    hint.textContent = `Shared scenario “${response.data.name}” loaded`;
  }
}
