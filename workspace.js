export const DRAFT_KEY = 'playmaker.draft';
export const ONBOARDING_KEY = 'playmaker.onboarded';
export const SHORTCUTS = Object.freeze([
  { keys: ['Space'], action: 'Analyse the current pitch' },
  { keys: ['Mod', 'Z'], action: 'Undo the last pitch change' },
  { keys: ['Mod', 'Shift', 'Z'], action: 'Redo the last pitch change' },
  { keys: ['Mod', 'D'], action: 'Duplicate the current scenario' },
  { keys: ['Mod', 'S'], action: 'Save the current scenario' },
  { keys: ['1'], action: 'Home player tool' },
  { keys: ['2'], action: 'Away player tool' },
  { keys: ['3'], action: 'Ball tool' },
  { keys: ['4'], action: 'Erase brush' },
  { keys: ['L'], action: 'Toggle passing lanes' },
  { keys: ['H'], action: 'Toggle pressure heatmap' },
  { keys: ['R'], action: 'Replay the selected play' },
  { keys: ['?'], action: 'Open keyboard shortcuts' },
]);

export function cloneState(value) {
  return structuredClone(value);
}

export function statesEqual(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function createHistory(initial) {
  return { past: [], present: cloneState(initial), future: [] };
}

export function pushHistory(history, next) {
  if (statesEqual(history.present, next)) return history;
  return {
    past: [...history.past, history.present].slice(-80),
    present: cloneState(next),
    future: [],
  };
}

export function undoHistory(history) {
  if (!history.past.length) return history;
  const present = history.past.at(-1);
  return { past: history.past.slice(0, -1), present: cloneState(present), future: [history.present, ...history.future] };
}

export function redoHistory(history) {
  if (!history.future.length) return history;
  const [present, ...future] = history.future;
  return { past: [...history.past, history.present], present: cloneState(present), future };
}

export function duplicateScenario(record, now = new Date().toISOString()) {
  return {
    ...cloneState(record),
    id: `scenario-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    name: `${record.name || 'Scenario'} copy`,
    savedAt: now,
  };
}

export function appendVersion(versions, snapshot, now = new Date().toISOString()) {
  return [{ savedAt: now, state: cloneState(snapshot) }, ...versions].slice(0, 30);
}

export function compareVersions(current, previous, analyze) {
  const latest = analyze(current);
  const earlier = analyze(previous);
  return {
    latest,
    earlier,
    probabilityDelta: round((latest.recommendations[0]?.probability || 0) - (earlier.recommendations[0]?.probability || 0), 3),
    topPlayChanged: latest.recommendations[0]?.id !== earlier.recommendations[0]?.id,
  };
}

export function createAnnotation(text, position = null, now = new Date().toISOString()) {
  const note = String(text || '').trim().slice(0, 280);
  if (!note) return null;
  return { id: `note-${Date.now()}`, text: note, x: position?.x ?? null, y: position?.y ?? null, createdAt: now };
}

export function readJson(storage, key, fallback) {
  try {
    const raw = storage?.getItem?.(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function writeJson(storage, key, value) {
  try {
    storage?.setItem?.(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function shortcutMatches(event, shortcut) {
  const keys = shortcut.keys;
  const needsMod = keys.includes('Mod');
  const needsShift = keys.includes('Shift');
  const key = keys.filter((item) => item !== 'Mod' && item !== 'Shift').at(-1);
  const pressed = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  const shiftOk = needsShift ? Boolean(event.shiftKey) : needsMod ? !event.shiftKey : true;
  return Boolean(key) && pressed === key && Boolean(event.metaKey || event.ctrlKey) === needsMod && shiftOk;
}

function round(value, decimals) {
  return Number(value.toFixed(decimals));
}
