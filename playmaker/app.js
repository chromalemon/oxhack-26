import { analyzeScenario, createDefaultScenario, getPlayAnimation, MAX_PLAYERS_PER_TEAM } from './analysis.js';

const STORAGE_KEY = 'playmaker.saved-scenarios';
const THEME_KEY = 'playmaker.theme';
const pitch = document.querySelector('#pitch');
const markerLayer = document.querySelector('#markerLayer');
const hint = document.querySelector('#pitchHint');
const markerCount = document.querySelector('#markerCount');
const recommendations = document.querySelector('#recommendations');
const insightText = document.querySelector('#insightText');
const panelIntro = document.querySelector('#panelIntro');
const toolButtons = document.querySelectorAll('.tool-button');
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

let activeTool = 'player';
let state = createDefaultScenario();
let model = null;
let account = readAccount();
let authenticated = false;
let isErasing = false;
let authMode = 'login';

function render() {
  renderMarkers();
  renderRecommendations(analyzeScenario(state, model));
  riskInput.value = state.risk;
  riskValue.textContent = `${state.risk}%`;
  gameStateInput.value = state.gameState;
  mentalityInput.value = state.mentality;
  renderAccount();
  renderSavedCount();
  modelStatus.textContent = model ? 'Model online' : 'Loading model';
  modelMeta.textContent = model?.model_version || 'Local tactical baseline';
  homeTeamInput.value = state.homeTeam;
  awayTeamInput.value = state.awayTeam;
  minuteInput.value = state.minute;
  homeTeamLabel.textContent = state.homeTeam || 'Home team';
  awayTeamLabel.textContent = state.awayTeam || 'Away team';
  matchMinuteLabel.textContent = `${String(state.minute).padStart(2, '0')}:00`;
  homeLegend.textContent = state.homeTeam || 'Home team';
  awayLegend.textContent = state.awayTeam || 'Away team';
  homeToolLabel.textContent = state.homeTeam || 'Home team';
  awayToolLabel.textContent = state.awayTeam || 'Away team';
  momentumLabel.textContent = `${state.homeTeam || 'Home team'} +18%`;
}

function renderMarkers() {
  markerLayer.replaceChildren();
  state.players.forEach((player) => markerLayer.appendChild(createMarker(player, 'player')));
  markerLayer.appendChild(createMarker({ ...state.ball, id: 'ball' }, 'ball'));
  const homeCount = state.players.filter((player) => (player.team || 'home') === 'home').length;
  const awayCount = state.players.filter((player) => player.team === 'away').length;
  markerCount.textContent = `${state.homeTeam || 'Home team'} ${homeCount}/${MAX_PLAYERS_PER_TEAM} · ${state.awayTeam || 'Away team'} ${awayCount}/${MAX_PLAYERS_PER_TEAM}`;
}

function createMarker(marker, type) {
  const element = document.createElement('div');
  element.className = type === 'ball' ? 'ball-marker' : marker.team === 'away' ? 'player-marker opponent-marker' : 'player-marker';
  element.dataset.markerId = marker.id;
  element.dataset.markerType = type;
  element.dataset.team = marker.team || 'home';
  element.style.left = `${marker.x * 100}%`;
  element.style.top = `${marker.y * 100}%`;
  if (type === 'player') element.textContent = marker.number;
  element.title = type === 'ball' ? 'Ball' : `Player ${marker.number}`;
  return element;
}

function renderRecommendations(result) {
  recommendations.replaceChildren(...result.recommendations.map((recommendation, index) => {
    const article = document.createElement('article');
    article.className = `recommendation${index === 0 ? ' featured' : ''}`;
    article.dataset.playId = recommendation.id;
    article.tabIndex = 0;
    const confidenceClass = recommendation.confidence === 'Good option' ? ' medium' : recommendation.confidence === 'Situational' ? ' low' : '';
    article.innerHTML = `<div class="rec-top"><span class="rank">${String(index + 1).padStart(2, '0')}</span><span class="confidence${confidenceClass}">${escapeHtml(recommendation.confidence)}</span></div><div class="rec-title-row"><div><h3>${escapeHtml(recommendation.label)}</h3><p>${escapeHtml(recommendation.detail)}</p></div><strong class="probability">${Math.round(recommendation.probability * 100)}<small>%</small></strong></div><div class="probability-bar"><span style="width: ${recommendation.probability * 100}%"></span></div><div class="rec-reason"><strong>Why it fits</strong><span>${escapeHtml(recommendation.why)}</span><strong>Watch for</strong><span>${escapeHtml(recommendation.failureRisk)}</span></div><div class="rec-footer"><span>Expected gain <b>+${recommendation.expectedGain}m</b></span><span>Risk <b class="${recommendation.risk}-risk">${capitalize(recommendation.risk)}</b></span></div><span class="rec-action">View play →</span>`;
    return article;
  }));
  insightText.textContent = result.insight;
  panelIntro.textContent = `Based on the current shape, scoreline, and ${result.sampleSize.toLocaleString()} similar moments.`;
}

function setTool(tool) {
  activeTool = tool;
  toolButtons.forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
  hint.textContent = tool === 'ball' ? 'Click to move the ball' : tool === 'erase' ? 'Drag the brush across players to erase' : tool === 'opponent' ? `Click anywhere to add a ${state.awayTeam || 'opponent'} player` : `Click anywhere to add a ${state.homeTeam || 'home team'} player`;
  eraseBrush.hidden = tool !== 'erase';
}

function updateEraseBrush(event) {
  const bounds = pitch.getBoundingClientRect();
  eraseBrush.style.left = `${event.clientX - bounds.left}px`;
  eraseBrush.style.top = `${event.clientY - bounds.top}px`;
}

function eraseAt(event) {
  const bounds = pitch.getBoundingClientRect();
  const x = clamp((event.clientX - bounds.left) / bounds.width);
  const y = clamp((event.clientY - bounds.top) / bounds.height);
  const radius = 0.065;
  const before = state.players.length;
  state.players = state.players.filter((player) => Math.hypot(player.x - x, player.y - y) > radius);
  if (state.players.length !== before) {
    render();
    hint.textContent = `${before - state.players.length} player${before - state.players.length === 1 ? '' : 's'} erased`;
  }
}

function handlePitchClick(event) {
  const clickedMarker = event.target.closest('[data-marker-id]');
  if (activeTool === 'erase') {
    return;
  }
  if (clickedMarker) return;
  const bounds = pitch.getBoundingClientRect();
  const position = { x: clamp((event.clientX - bounds.left) / bounds.width), y: clamp((event.clientY - bounds.top) / bounds.height) };
  if (activeTool === 'ball') {
    state.ball = { ...state.ball, ...position };
    hint.textContent = 'Ball position updated';
  } else {
    const team = activeTool === 'opponent' ? 'away' : 'home';
    const teamPlayers = state.players.filter((player) => (player.team || 'home') === team);
    if (teamPlayers.length >= MAX_PLAYERS_PER_TEAM) {
      hint.textContent = `Maximum ${MAX_PLAYERS_PER_TEAM} ${team === 'away' ? 'opponent' : 'home'} players reached`;
      return;
    }
    const number = teamPlayers.length ? Math.max(...teamPlayers.map((player) => player.number)) + 1 : 1;
    state.players.push({ id: `player-${Date.now()}`, number, team, ...position });
    hint.textContent = `${team === 'away' ? state.awayTeam || 'Opponent' : state.homeTeam || 'Home team'} player ${number} placed`;
  }
  render();
}

function analyse() {
  analyseButton.disabled = true;
  analyseButton.innerHTML = '<span class="spark">✦</span> Reading the shape...';
  window.setTimeout(() => {
    renderRecommendations(analyzeScenario(state, model));
    analyseButton.innerHTML = '<span class="spark">✦</span> Analyse next plays <span class="arrow">→</span>';
    analyseButton.disabled = false;
    document.querySelector('.recommendations-panel').animate([{ transform: 'translateY(4px)', opacity: .6 }, { transform: 'translateY(0)', opacity: 1 }], { duration: 350, easing: 'ease-out' });
  }, 500);
}

function openAnimation(playId) {
  const animation = getPlayAnimation(playId, state);
  animationTitle.textContent = animation.title;
  animationExplanation.textContent = animation.explanation;
  animationSteps.replaceChildren(...animation.phases.map((phase, index) => {
    const step = document.createElement('li');
    step.innerHTML = `<span>${index + 1}</span><strong>${phase}</strong>`;
    return step;
  }));
  renderAnimationPitch(playId);
  animationDialog.showModal();
  runAnimation(playId);
  animateLivePitch(playId);
}

function animateLivePitch(playId) {
  const ball = markerLayer.querySelector('[data-marker-type="ball"]');
  const player = markerLayer.querySelector('[data-marker-type="player"][data-team="home"]');
  if (!ball || !player || typeof ball.animate !== 'function') return;
  const routes = {
    'progressive-pass': { ball: ['69%', '39%'], player: ['42%', '46%'] },
    'switch-of-play': { ball: ['80%', '23%'], player: ['52%', '43%'] },
    'carry-forward': { ball: ['61%', '46%'], player: ['55%', '48%'] },
    'safe-recycle': { ball: ['30%', '39%'], player: ['35%', '44%'] },
  };
  const route = routes[playId] || routes['safe-recycle'];
  ball.animate([{ left: ball.style.left, top: ball.style.top }, { left: route.ball[0], top: route.ball[1] }], { duration: 1800, easing: 'cubic-bezier(.22,.61,.36,1)', fill: 'both' });
  player.animate([{ left: player.style.left, top: player.style.top }, { left: route.player[0], top: route.player[1] }], { duration: 1800, easing: 'ease-in-out', fill: 'both' });
}

function renderAnimationPitch(playId) {
  animationPitch.innerHTML = '<div class="pitch-line halfway"></div><div class="pitch-circle"></div><div class="pitch-spot"></div><div class="penalty-box left-box"></div><div class="goal left-goal"></div><div class="six-yard left-six"></div><div class="penalty-box right-box"></div><div class="goal right-goal"></div><div class="six-yard right-six"></div><div id="animationMarkers"></div><div class="animation-target" id="animationTarget"></div>';
  const markers = animationPitch.querySelector('#animationMarkers');
  state.players.forEach((player) => markers.appendChild(createAnimationMarker(player, 'player')));
  markers.appendChild(createAnimationMarker({ ...state.ball, id: 'ball' }, 'ball'));
  animationPitch.dataset.playId = playId;
}

function runAnimation(playId) {
  const ball = animationPitch.querySelector('[data-animation-type="ball"]');
  const playerState = [...state.players].filter((player) => (player.team || 'home') === 'home').sort((first, second) => distanceToBall(first) - distanceToBall(second))[0];
  const player = playerState && animationPitch.querySelector(`[data-animation-id="${playerState.id}"]`);
  const target = animationPitch.querySelector('#animationTarget');
  if (!ball || !player || typeof ball.animate !== 'function') return;
  const targetPosition = animationTarget(playId);
  const playerPosition = playId === 'safe-recycle' ? { x: Math.max(0.08, targetPosition.x - 0.12), y: targetPosition.y } : targetPosition;
  target.style.left = `${targetPosition.x * 100}%`;
  target.style.top = `${targetPosition.y * 100}%`;
  ball.animate([{ left: ball.style.left, top: ball.style.top }, { left: `${targetPosition.x * 100}%`, top: `${targetPosition.y * 100}%` }], { duration: 1800, easing: 'cubic-bezier(.22,.61,.36,1)', iterations: 2, direction: 'alternate' });
  player.animate([{ left: player.style.left, top: player.style.top }, { left: `${playerPosition.x * 100}%`, top: `${playerPosition.y * 100}%` }], { duration: 1800, easing: 'ease-in-out', iterations: 2, direction: 'alternate' });
}

function createAnimationMarker(marker, type) {
  const element = document.createElement('div');
  element.className = type === 'ball' ? 'animation-ball' : marker.team === 'away' ? 'animation-player animation-opponent' : 'animation-player';
  element.dataset.animationId = marker.id;
  element.dataset.animationType = type;
  element.style.left = `${marker.x * 100}%`;
  element.style.top = `${marker.y * 100}%`;
  if (type === 'player') element.textContent = marker.number;
  return element;
}

function distanceToBall(player) { return Math.hypot(player.x - state.ball.x, player.y - state.ball.y); }

function animationTarget(playId) {
  const delta = { 'progressive-pass': { x: 0.28, y: -0.1 }, 'switch-of-play': { x: 0.2, y: -0.3 }, 'carry-forward': { x: 0.22, y: 0 }, 'safe-recycle': { x: -0.2, y: -0.12 } }[playId] || { x: 0.1, y: 0 };
  return { x: clamp(state.ball.x + delta.x), y: clamp(state.ball.y + delta.y) };
}

async function saveScenario() {
  const scenarios = readSavedScenarios();
  const scenario = { id: `scenario-${Date.now()}`, name: `Scenario ${scenarios.length + 1}`, savedAt: new Date().toISOString(), owner: account.email, state: structuredClone(state) };
  if (authenticated) {
    const remote = await apiRequest('/api/scenarios', { method: 'POST', body: { name: scenario.name, state: scenario.state } });
    if (remote.ok) scenario.id = remote.data.id;
  }
  scenarios.unshift(scenario);
  writeSavedScenarios(scenarios.slice(0, 10));
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
    item.innerHTML = `<div><strong>${scenario.name}</strong><small>${new Date(scenario.savedAt).toLocaleString()}</small></div><span><button class="load-scenario" data-id="${scenario.id}">Load</button><button class="delete-scenario" data-id="${scenario.id}" aria-label="Delete ${scenario.name}">×</button></span>`;
    return item;
  }) : [Object.assign(document.createElement('li'), { className: 'empty-state', textContent: 'No saved scenarios yet.' })]));
}

async function handleSavedListClick(event) {
  const id = event.target.dataset.id;
  if (!id) return;
  const scenarios = readSavedScenarios();
  if (event.target.classList.contains('load-scenario')) {
    const selected = scenarios.find((scenario) => scenario.id === id);
    if (selected) { state = selected.state; render(); hint.textContent = `${selected.name} loaded`; savedPanel.close(); }
  } else if (event.target.classList.contains('delete-scenario')) {
    if (authenticated) await apiRequest(`/api/scenarios/${id}`, { method: 'DELETE' });
    writeSavedScenarios(scenarios.filter((scenario) => scenario.id !== id));
    renderSavedList();
    renderSavedCount();
  }
}

function renderAccount() {
  profileName.textContent = authenticated ? account.name : 'Guest';
  profileType.textContent = authenticated ? account.email : 'Guest session';
  accountNameInput.value = authenticated ? account.name : '';
  accountEmailInput.value = authenticated ? account.email : '';
  logoutButton.hidden = !authenticated;
  authStatus.textContent = authenticated ? `Signed in as ${account.name}` : 'Guest mode';
  authStatus.classList.toggle('guest', !authenticated);
  authStatus.classList.toggle('signed-in', authenticated);
  accountTitle.textContent = authenticated ? 'Your account' : authMode === 'login' ? 'Log in to Playmaker' : 'Create your Playmaker account';
  guestStatus.hidden = authenticated;
  accountStatus.textContent = authenticated ? 'Account connected.' : '';
}

async function saveAccount(event) {
  event.preventDefault();
  const email = accountEmailInput.value.trim();
  const password = accountPasswordInput.value;
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
  accountPanel.close();
}

function readAccount() {
  return { name: 'Guest', email: 'Guest session' };
}

function setAuthMode(mode) {
  authMode = mode;
  const registering = mode === 'register';
  loginMode.classList.toggle('active', !registering);
  registerMode.classList.toggle('active', registering);
  accountNameField.hidden = !registering;
  accountNameInput.required = registering;
  accountPasswordInput.autocomplete = registering ? 'new-password' : 'current-password';
  accountSubmit.innerHTML = `${registering ? 'Create account' : 'Log in'} <span class="arrow">→</span>`;
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
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

function writeSavedScenarios(scenarios) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(scenarios)); } catch { /* Storage is optional for this local prototype. */ }
}

function renderSavedCount() { savedCount.textContent = String(Math.min(readSavedScenarios().length, 10)); }
function capitalize(value) { return value.charAt(0).toUpperCase() + value.slice(1); }
function clamp(value) { return Math.max(0, Math.min(1, value)); }
function escapeHtml(value) { return String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]); }
function applyTheme(theme) { document.documentElement.dataset.theme = theme; themeButton.innerHTML = `${theme === 'dark' ? '☼' : '◐'} <span>${theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>`; }

toolButtons.forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool)));
pitch.addEventListener('click', handlePitchClick);
pitch.addEventListener('pointerdown', (event) => { if (activeTool === 'erase') { isErasing = true; pitch.setPointerCapture(event.pointerId); updateEraseBrush(event); eraseAt(event); } });
pitch.addEventListener('pointermove', (event) => { if (activeTool === 'erase') { updateEraseBrush(event); if (isErasing) eraseAt(event); } });
pitch.addEventListener('pointerup', () => { isErasing = false; });
pitch.addEventListener('pointerleave', () => { if (!isErasing) eraseBrush.hidden = true; });
pitch.addEventListener('pointerenter', (event) => { if (activeTool === 'erase') { eraseBrush.hidden = false; updateEraseBrush(event); } });
recommendations.addEventListener('click', (event) => { const card = event.target.closest('[data-play-id]'); if (card) openAnimation(card.dataset.playId); });
recommendations.addEventListener('keydown', (event) => { if (event.key === 'Enter') event.target.closest('[data-play-id]')?.click(); });
analyseButton.addEventListener('click', analyse);
resetButton.addEventListener('click', () => { state = createDefaultScenario(); setTool('player'); render(); });
saveButton.addEventListener('click', saveScenario);
savedNav.addEventListener('click', openSavedScenarios);
savedList.addEventListener('click', handleSavedListClick);
savedClose.addEventListener('click', () => savedPanel.close());
accountButton.addEventListener('click', () => accountPanel.showModal());
accountClose.addEventListener('click', () => accountPanel.close());
accountForm.addEventListener('submit', saveAccount);
document.querySelector('#settingsNav').addEventListener('click', () => accountPanel.showModal());
document.querySelector('#modelsNav').addEventListener('click', (event) => { event.preventDefault(); document.querySelector('.recommendations-panel').scrollIntoView({ behavior: 'smooth', block: 'center' }); });
document.querySelector('#helpButton').addEventListener('click', () => document.querySelector('#helpPanel').showModal());
document.querySelector('#helpClose').addEventListener('click', () => document.querySelector('#helpPanel').close());
riskInput.addEventListener('input', () => { state.risk = Number(riskInput.value); riskValue.textContent = `${state.risk}%`; });
gameStateInput.addEventListener('change', () => { state.gameState = gameStateInput.value; });
mentalityInput.addEventListener('change', () => { state.mentality = mentalityInput.value; });
themeButton.addEventListener('click', () => { const theme = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'; localStorage.setItem(THEME_KEY, theme); applyTheme(theme); });
animationClose.addEventListener('click', () => animationDialog.close());
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
loginMode.addEventListener('click', () => setAuthMode('login'));
registerMode.addEventListener('click', () => setAuthMode('register'));
homeTeamInput.addEventListener('input', () => { state.homeTeam = homeTeamInput.value; render(); });
awayTeamInput.addEventListener('input', () => { state.awayTeam = awayTeamInput.value; render(); });
minuteInput.addEventListener('input', () => { state.minute = Math.max(0, Math.min(120, Number(minuteInput.value) || 0)); render(); });

savedCount.textContent = String(Math.min(readSavedScenarios().length, 10));
eraseBrush.hidden = true;
render();
setAuthMode('login');
applyTheme(localStorage.getItem(THEME_KEY) || 'light');
loadModel();
restoreSession();

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
    render();
  }
}
