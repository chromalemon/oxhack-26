import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { MAX_PLAYERS_PER_TEAM, PLAY_TYPES, retrainModel } from './analysis.js';
import { buildTacticalReport } from './report.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATABASE = path.join(ROOT, 'data', 'playmaker.sqlite');
const SESSION_DAYS = 7;
const RESET_MINUTES = 45;
let liveModel = null;
let baseModel = null;

export function createServer({ databasePath = process.env.PLAYMAKER_DATABASE || DEFAULT_DATABASE, model = null } = {}) {
  const database = createDatabase(databasePath);
  baseModel = model;
  liveModel = retrainFromFeedback(database, baseModel);
  return http.createServer(async (request, response) => {
    try {
      await handleRequest(request, response, database);
    } catch (error) {
      writeJson(response, error.statusCode || 500, { error: error.message || 'Internal server error' });
    }
  });
}

async function handleRequest(request, response, database) {
  const url = new URL(request.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) return handleApi(request, response, url, database);
  return serveStatic(response, url.pathname);
}

async function handleApi(request, response, url, database) {
  const body = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method) ? await readJson(request) : {};
  if (request.method === 'GET' && url.pathname === '/api/health') return writeJson(response, 200, { status: 'ok' });
  if (request.method === 'GET' && url.pathname === '/api/model') return writeJson(response, 200, publicModel(database));
  if (request.method === 'POST' && url.pathname === '/api/auth/register') return registerAccount(response, database, body);
  if (request.method === 'POST' && url.pathname === '/api/auth/login') return loginAccount(response, database, body);
  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = readToken(request);
    if (token) database.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    response.setHeader('Set-Cookie', 'playmaker_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return writeJson(response, 204, null);
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/forgot-password') return forgotPassword(response, database, body);
  if (request.method === 'POST' && url.pathname === '/api/auth/reset-password') return resetPassword(response, database, body);
  if (request.method === 'POST' && url.pathname === '/api/auth/verify-email') return verifyEmail(response, database, body);
  if (request.method === 'GET' && url.pathname.startsWith('/api/share/')) return getSharedScenario(response, database, url.pathname.split('/').at(-1));
  if (request.method === 'GET' && url.pathname.match(/^\/api\/scenarios\/[^/]+\/report$/)) {
    const account = optionalAccount(request, database);
    const scenario = loadAccessibleScenario(database, url.pathname.split('/')[3], account, 'viewer');
    const record = publicScenario(scenario);
    return writeJson(response, 200, buildTacticalReport({ ...record.state, name: record.name, notes: record.notes }, liveModel));
  }

  const account = requireAccount(request, database);
  if (request.method === 'GET' && url.pathname === '/api/me') return writeJson(response, 200, publicAccount(account, database));
  if (request.method === 'PATCH' && url.pathname === '/api/me') return updateAccount(response, database, account, body);
  if (request.method === 'DELETE' && url.pathname === '/api/me') return deleteAccount(response, database, account, body);
  if (request.method === 'POST' && url.pathname === '/api/auth/resend-verification') return resendVerification(response, database, account);

  if (url.pathname === '/api/workspaces' && request.method === 'GET') return writeJson(response, 200, listWorkspaces(database, account.id));
  if (url.pathname === '/api/workspaces' && request.method === 'POST') return createWorkspace(response, database, account, body);
  const workspaceMemberMatch = url.pathname.match(/^\/api\/workspaces\/([^/]+)\/members$/);
  if (workspaceMemberMatch && request.method === 'POST') return addWorkspaceMember(response, database, account, workspaceMemberMatch[1], body);

  if (url.pathname === '/api/notifications' && request.method === 'GET') {
    const rows = database.prepare('SELECT id, kind, message, read_at AS readAt, created_at AS createdAt FROM notifications WHERE account_id = ? ORDER BY created_at DESC').all(account.id);
    return writeJson(response, 200, rows);
  }
  if (url.pathname === '/api/notifications/read' && request.method === 'POST') {
    database.prepare('UPDATE notifications SET read_at = ? WHERE account_id = ? AND read_at IS NULL').run(new Date().toISOString(), account.id);
    return writeJson(response, 204, null);
  }
  if (url.pathname === '/api/analysis/completed' && request.method === 'POST') {
    const name = typeof body.scenarioName === 'string' ? body.scenarioName.slice(0, 80) : 'your scenario';
    const recommendation = typeof body.recommendation === 'string' ? body.recommendation.slice(0, 80) : 'Analysis complete';
    notify(database, account.id, 'analysis', `${recommendation} analysis completed for ${name}`);
    return writeJson(response, 204, null);
  }

  if (url.pathname === '/api/scenarios' && request.method === 'GET') {
    const rows = listVisibleScenarios(database, account.id);
    return writeJson(response, 200, rows.map(publicScenario));
  }
  if (url.pathname === '/api/scenarios' && request.method === 'POST') return createScenario(response, database, account, body);

  const commentMatch = url.pathname.match(/^\/api\/scenarios\/([^/]+)\/comments$/);
  if (commentMatch) {
    const scenario = loadAccessibleScenario(database, commentMatch[1], account, 'viewer');
    if (request.method === 'GET') {
      const comments = database.prepare('SELECT c.id, c.body, c.parent_id AS parentId, c.created_at AS createdAt, a.name AS author FROM comments c JOIN accounts a ON a.id = c.author_id WHERE c.scenario_id = ? ORDER BY c.created_at').all(scenario.id);
      return writeJson(response, 200, comments);
    }
    if (request.method === 'POST') {
      loadAccessibleScenario(database, commentMatch[1], account, 'viewer');
      const comment = { id: crypto.randomUUID(), body: requiredText(body.body, 'body').slice(0, 600), parentId: body.parentId || null, createdAt: new Date().toISOString() };
      database.prepare('INSERT INTO comments (id, scenario_id, author_id, parent_id, body, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(comment.id, scenario.id, account.id, comment.parentId, comment.body, comment.createdAt);
      notify(database, scenario.ownerId, 'comment', `${account.name} commented on ${scenario.name}`, scenario.ownerId === account.id ? scenario.ownerId : null);
      return writeJson(response, 201, { ...comment, author: account.name });
    }
  }

  const shareMatch = url.pathname.match(/^\/api\/scenarios\/([^/]+)\/share$/);
  if (shareMatch && request.method === 'POST') {
    const scenario = loadAccessibleScenario(database, shareMatch[1], account, 'owner');
    const permission = ['viewer', 'editor'].includes(body.permission) ? body.permission : 'viewer';
    const share = { id: crypto.randomUUID(), token: crypto.randomBytes(18).toString('hex'), permission, createdAt: new Date().toISOString() };
    database.prepare('INSERT INTO shares (id, scenario_id, token, permission, created_at) VALUES (?, ?, ?, ?, ?)').run(share.id, scenario.id, share.token, share.permission, share.createdAt);
    return writeJson(response, 201, { ...share, url: `/api/share/${share.token}` });
  }

  const collabMatch = url.pathname.match(/^\/api\/scenarios\/([^/]+)\/collaborators$/);
  if (collabMatch && request.method === 'POST') {
    const scenario = loadAccessibleScenario(database, collabMatch[1], account, 'owner');
    const email = normalizeEmail(body.email);
    const collaborator = database.prepare('SELECT id, name, email FROM accounts WHERE email = ?').get(email);
    if (!collaborator) throw httpError(404, 'Account not found');
    const permission = ['viewer', 'editor'].includes(body.permission) ? body.permission : 'viewer';
    database.prepare('INSERT INTO scenario_permissions (scenario_id, account_id, permission) VALUES (?, ?, ?) ON CONFLICT(scenario_id, account_id) DO UPDATE SET permission = excluded.permission').run(scenario.id, collaborator.id, permission);
    notify(database, collaborator.id, 'share', `${account.name} shared “${scenario.name}” with you`);
    return writeJson(response, 201, { email: collaborator.email, permission });
  }

  const versionMatch = url.pathname.match(/^\/api\/scenarios\/([^/]+)\/versions$/);
  if (versionMatch && request.method === 'GET') {
    const scenario = loadAccessibleScenario(database, versionMatch[1], account, 'viewer');
    const versions = database.prepare('SELECT id, saved_at AS savedAt, state_json AS stateJson FROM scenario_versions WHERE scenario_id = ? ORDER BY saved_at DESC').all(scenario.id);
    return writeJson(response, 200, versions.map((row) => ({ id: row.id, savedAt: row.savedAt, state: JSON.parse(row.stateJson) })));
  }

  const duplicateMatch = url.pathname.match(/^\/api\/scenarios\/([^/]+)\/duplicate$/);
  if (duplicateMatch && request.method === 'POST') {
    const scenario = loadAccessibleScenario(database, duplicateMatch[1], account, 'viewer');
    return createScenario(response, database, account, { name: `${scenario.name} copy`, state: publicScenario(scenario).state, notes: scenario.notes });
  }

  if (url.pathname === '/api/model/feedback' && request.method === 'POST') {
    const predicted = requiredText(body.predicted, 'predicted');
    const actual = requiredText(body.actual, 'actual');
    const allowedPlays = PLAY_TYPES.map((play) => play.id);
    const features = body.features;
    if (!allowedPlays.includes(predicted) || !allowedPlays.includes(actual)) throw httpError(400, 'predicted and actual must be known play types');
    if (!Array.isArray(features) || features.length !== 9 || !features.every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) throw httpError(400, 'features must contain nine normalized model inputs');
    database.prepare('INSERT INTO model_feedback (id, account_id, predicted, actual, features_json, created_at) VALUES (?, ?, ?, ?, ?, ?)').run(crypto.randomUUID(), account.id, predicted, actual, JSON.stringify(features), new Date().toISOString());
    const samples = database.prepare('SELECT predicted, actual, features_json AS featuresJson FROM model_feedback').all().map((row) => ({ predicted: row.predicted, actual: row.actual, features: JSON.parse(row.featuresJson || '[]'), label: actionFromPlay(row.actual) }));
    if (baseModel) liveModel = retrainModel(baseModel, samples.filter((sample) => sample.features.length));
    notify(database, account.id, 'analysis', 'Model feedback recorded. Recommendations will use the updated weights.');
    return writeJson(response, 201, publicModel(database));
  }

  const scenarioMatch = url.pathname.match(/^\/api\/scenarios\/([^/]+)$/);
  if (scenarioMatch) {
    if (request.method === 'GET') return writeJson(response, 200, publicScenario(loadAccessibleScenario(database, scenarioMatch[1], account, 'viewer')));
    if (request.method === 'PUT' || request.method === 'PATCH') {
      const scenario = loadAccessibleScenario(database, scenarioMatch[1], account, 'editor');
      if (body.state) validateScenarioState(body.state);
      const name = body.name === undefined ? scenario.name : requiredText(body.name, 'name');
      const notes = body.notes === undefined ? scenario.notes : String(body.notes || '').slice(0, 800);
      const state = body.state === undefined ? scenario.state : body.state;
      const savedAt = new Date().toISOString();
      database.prepare('UPDATE scenarios SET name = ?, notes = ?, state_json = ?, saved_at = ? WHERE id = ?').run(name, notes, JSON.stringify(state), savedAt, scenario.id);
      saveVersion(database, scenario.id, state, savedAt);
      return writeJson(response, 200, publicScenario({ ...scenario, name, notes, stateJson: JSON.stringify(state), savedAt }));
    }
    if (request.method === 'DELETE') {
      const scenario = loadAccessibleScenario(database, scenarioMatch[1], account, 'owner');
      database.prepare('DELETE FROM scenarios WHERE id = ?').run(scenario.id);
      return writeJson(response, 204, null);
    }
  }
  throw httpError(404, 'Route not found');
}

async function registerAccount(response, database, body) {
  const name = requiredText(body.name, 'name');
  const email = normalizeEmail(body.email);
  const password = requiredText(body.password, 'password');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  if (database.prepare('SELECT id FROM accounts WHERE email = ?').get(email)) throw httpError(409, 'An account with this email already exists');
  const account = { id: crypto.randomUUID(), name, email, createdAt: new Date().toISOString(), emailVerified: 0, verificationToken: crypto.randomBytes(16).toString('hex') };
  database.prepare('INSERT INTO accounts (id, name, email, password_hash, created_at, email_verified, verification_token) VALUES (?, ?, ?, ?, ?, ?, ?)').run(account.id, account.name, account.email, hashPassword(password), account.createdAt, 0, account.verificationToken);
  const workspaceId = crypto.randomUUID();
  database.prepare('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)').run(workspaceId, `${name}'s team`, account.createdAt);
  database.prepare('INSERT INTO workspace_members (workspace_id, account_id, role) VALUES (?, ?, ?)').run(workspaceId, account.id, 'owner');
  notify(database, account.id, 'account', 'Verify your email to finish setting up Playmaker.');
  await sendAccountEmail(account.email, 'Verify your Playmaker account', `Your Playmaker email verification token is: ${account.verificationToken}`);
  return authenticate(response, database, { ...account, workspaceId }, {
    emailDelivery: emailDeliveryState(),
    ...(process.env.NODE_ENV === 'production' ? {} : { verificationToken: account.verificationToken }),
  });
}

function loginAccount(response, database, body) {
  const email = normalizeEmail(body.email);
  const account = database.prepare('SELECT id, name, email, password_hash AS password, created_at AS createdAt, email_verified AS emailVerified FROM accounts WHERE email = ?').get(email);
  if (!account || !verifyPassword(body.password, account.password)) throw httpError(401, 'Invalid email or password');
  return authenticate(response, database, account);
}

async function forgotPassword(response, database, body) {
  const email = normalizeEmail(body.email);
  const account = database.prepare('SELECT id FROM accounts WHERE email = ?').get(email);
  if (account) {
    const token = crypto.randomBytes(18).toString('hex');
    const expires = new Date(Date.now() + RESET_MINUTES * 60_000).toISOString();
    database.prepare('UPDATE accounts SET reset_token = ?, reset_expires = ? WHERE id = ?').run(token, expires, account.id);
    notify(database, account.id, 'account', 'A password reset was requested for this account.');
    await sendAccountEmail(email, 'Reset your Playmaker password', `Your Playmaker password reset token is: ${token}`);
  }
  return writeJson(response, 200, { ok: true, delivery: emailDeliveryState(), ...(process.env.NODE_ENV === 'production' || !account ? {} : { resetToken: database.prepare('SELECT reset_token AS token FROM accounts WHERE id = ?').get(account.id).token }) });
}

function resetPassword(response, database, body) {
  const token = requiredText(body.token, 'token');
  const password = requiredText(body.password, 'password');
  if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
  const account = database.prepare('SELECT id, name, email, created_at AS createdAt FROM accounts WHERE reset_token = ? AND reset_expires > ?').get(token, new Date().toISOString());
  if (!account) throw httpError(400, 'Reset token is invalid or expired');
  database.prepare('UPDATE accounts SET password_hash = ?, reset_token = NULL, reset_expires = NULL WHERE id = ?').run(hashPassword(password), account.id);
  database.prepare('DELETE FROM sessions WHERE account_id = ?').run(account.id);
  return authenticate(response, database, account);
}

function verifyEmail(response, database, body) {
  const token = requiredText(body.token, 'token');
  const account = database.prepare('SELECT id FROM accounts WHERE verification_token = ?').get(token);
  if (!account) throw httpError(400, 'Verification token is invalid');
  database.prepare('UPDATE accounts SET email_verified = 1, verification_token = NULL WHERE id = ?').run(account.id);
  return writeJson(response, 200, { ok: true, verified: true });
}

async function resendVerification(response, database, account) {
  const token = crypto.randomBytes(16).toString('hex');
  database.prepare('UPDATE accounts SET verification_token = ? WHERE id = ?').run(token, account.id);
  await sendAccountEmail(account.email, 'Verify your Playmaker account', `Your Playmaker email verification token is: ${token}`);
  return writeJson(response, 200, { ok: true, delivery: emailDeliveryState(), ...(process.env.NODE_ENV === 'production' ? {} : { verificationToken: token }) });
}

function emailDeliveryState() {
  return process.env.PLAYMAKER_EMAIL_API_URL && process.env.PLAYMAKER_EMAIL_API_KEY ? 'configured' : 'unavailable';
}

async function sendAccountEmail(to, subject, text) {
  const endpoint = process.env.PLAYMAKER_EMAIL_API_URL;
  const apiKey = process.env.PLAYMAKER_EMAIL_API_KEY;
  if (!endpoint || !apiKey) return false;
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, text }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function updateAccount(response, database, account, body) {
  const name = body.name === undefined ? account.name : requiredText(body.name, 'name');
  const email = body.email === undefined ? account.email : normalizeEmail(body.email);
  try { database.prepare('UPDATE accounts SET name = ?, email = ? WHERE id = ?').run(name, email, account.id); } catch (error) { if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw httpError(409, 'An account with this email already exists'); throw error; }
  return writeJson(response, 200, publicAccount({ ...account, name, email }, database));
}

function deleteAccount(response, database, account, body) {
  const stored = database.prepare('SELECT password_hash AS password FROM accounts WHERE id = ?').get(account.id);
  if (!verifyPassword(body.password, stored.password)) throw httpError(401, 'Invalid password');
  database.prepare('DELETE FROM accounts WHERE id = ?').run(account.id);
  response.setHeader('Set-Cookie', 'playmaker_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
  return writeJson(response, 204, null);
}

function createWorkspace(response, database, account, body) {
  const workspace = { id: crypto.randomUUID(), name: requiredText(body.name, 'name'), createdAt: new Date().toISOString() };
  database.prepare('INSERT INTO workspaces (id, name, created_at) VALUES (?, ?, ?)').run(workspace.id, workspace.name, workspace.createdAt);
  database.prepare('INSERT INTO workspace_members (workspace_id, account_id, role) VALUES (?, ?, ?)').run(workspace.id, account.id, 'owner');
  return writeJson(response, 201, workspace);
}

function addWorkspaceMember(response, database, account, workspaceId, body) {
  const membership = database.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND account_id = ?').get(workspaceId, account.id);
  if (!membership || membership.role !== 'owner') throw httpError(403, 'Only workspace owners can add members');
  const email = normalizeEmail(body.email);
  const member = database.prepare('SELECT id FROM accounts WHERE email = ?').get(email);
  if (!member) throw httpError(404, 'Account not found');
  const role = ['owner', 'editor', 'viewer'].includes(body.role) ? body.role : 'editor';
  database.prepare('INSERT INTO workspace_members (workspace_id, account_id, role) VALUES (?, ?, ?) ON CONFLICT(workspace_id, account_id) DO UPDATE SET role = excluded.role').run(workspaceId, member.id, role);
  notify(database, member.id, 'workspace', `You were added to a Playmaker workspace`);
  return writeJson(response, 201, { email, role });
}

function createScenario(response, database, account, body) {
  validateScenarioState(body.state);
  const workspaceId = body.workspaceId || defaultWorkspace(database, account.id);
  if (workspaceId) assertWorkspaceMember(database, workspaceId, account.id);
  const scenario = { id: crypto.randomUUID(), ownerId: account.id, workspaceId, name: requiredText(body.name, 'name'), notes: String(body.notes || '').slice(0, 800), state: body.state || {}, savedAt: new Date().toISOString() };
  database.prepare('INSERT INTO scenarios (id, owner_id, workspace_id, name, notes, state_json, saved_at) VALUES (?, ?, ?, ?, ?, ?, ?)').run(scenario.id, scenario.ownerId, scenario.workspaceId, scenario.name, scenario.notes, JSON.stringify(scenario.state), scenario.savedAt);
  saveVersion(database, scenario.id, scenario.state, scenario.savedAt);
  notify(database, account.id, 'analysis', `Analysis saved for ${scenario.name}`);
  return writeJson(response, 201, scenario);
}

function getSharedScenario(response, database, token) {
  const share = database.prepare('SELECT s.token, s.permission, sc.id, sc.name, sc.notes, sc.state_json AS stateJson, sc.saved_at AS savedAt, sc.owner_id AS ownerId FROM shares s JOIN scenarios sc ON sc.id = s.scenario_id WHERE s.token = ?').get(token);
  if (!share) throw httpError(404, 'Share link not found');
  return writeJson(response, 200, { ...publicScenario(share), permission: share.permission, shared: true });
}

function createDatabase(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL, email_verified INTEGER NOT NULL DEFAULT 0, verification_token TEXT, reset_token TEXT, reset_expires TEXT);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workspaces (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS workspace_members (workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, role TEXT NOT NULL, PRIMARY KEY (workspace_id, account_id));
    CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL, name TEXT NOT NULL, notes TEXT NOT NULL DEFAULT '', state_json TEXT NOT NULL, saved_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS scenario_versions (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE, state_json TEXT NOT NULL, saved_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS scenario_permissions (scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, permission TEXT NOT NULL, PRIMARY KEY (scenario_id, account_id));
    CREATE TABLE IF NOT EXISTS shares (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, permission TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS comments (id TEXT PRIMARY KEY, scenario_id TEXT NOT NULL REFERENCES scenarios(id) ON DELETE CASCADE, author_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, parent_id TEXT, body TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS notifications (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, kind TEXT NOT NULL, message TEXT NOT NULL, read_at TEXT, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS model_feedback (id TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, predicted TEXT NOT NULL, actual TEXT NOT NULL, features_json TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
    CREATE INDEX IF NOT EXISTS idx_scenarios_owner_saved ON scenarios(owner_id, saved_at DESC);`);
  migrateAccounts(database);
  return database;
}

function migrateAccounts(database) {
  const columns = database.prepare('PRAGMA table_info(accounts)').all().map((column) => column.name);
  const statements = [
    ['email_verified', 'ALTER TABLE accounts ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 0'],
    ['verification_token', 'ALTER TABLE accounts ADD COLUMN verification_token TEXT'],
    ['reset_token', 'ALTER TABLE accounts ADD COLUMN reset_token TEXT'],
    ['reset_expires', 'ALTER TABLE accounts ADD COLUMN reset_expires TEXT'],
  ];
  for (const [name, sql] of statements) {
    if (!columns.includes(name)) database.exec(sql);
  }
  const scenarioColumns = database.prepare('PRAGMA table_info(scenarios)').all().map((column) => column.name);
  if (!scenarioColumns.includes('notes')) database.exec("ALTER TABLE scenarios ADD COLUMN notes TEXT NOT NULL DEFAULT ''");
  if (!scenarioColumns.includes('workspace_id')) database.exec('ALTER TABLE scenarios ADD COLUMN workspace_id TEXT');
}

function authenticate(response, database, account, extra = {}) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  database.prepare('INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)').run(token, account.id, expiresAt);
  response.setHeader('Set-Cookie', `playmaker_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
  return writeJson(response, 200, { ...publicAccount(account, database), ...extra });
}

function requireAccount(request, database) {
  const account = optionalAccount(request, database);
  if (!account) throw httpError(401, 'Authentication required');
  return account;
}

function optionalAccount(request, database) {
  const token = readToken(request);
  if (!token) return null;
  return database.prepare(`SELECT a.id, a.name, a.email, a.created_at AS createdAt, a.email_verified AS emailVerified FROM accounts a JOIN sessions s ON s.account_id = a.id WHERE s.token = ? AND s.expires_at > ?`).get(token, new Date().toISOString()) || null;
}

function loadAccessibleScenario(database, id, account, minimum = 'viewer') {
  const row = database.prepare('SELECT id, owner_id AS ownerId, workspace_id AS workspaceId, name, notes, state_json AS stateJson, saved_at AS savedAt FROM scenarios WHERE id = ?').get(id);
  if (!row) throw httpError(404, 'Scenario not found');
  const permission = scenarioPermission(database, row, account);
  if (!hasPermission(permission, minimum)) throw httpError(403, 'You do not have access to this scenario');
  return row;
}

function scenarioPermission(database, scenario, account) {
  if (!account) return null;
  if (scenario.ownerId === account.id) return 'owner';
  const direct = database.prepare('SELECT permission FROM scenario_permissions WHERE scenario_id = ? AND account_id = ?').get(scenario.id, account.id);
  if (direct) return direct.permission;
  if (scenario.workspaceId) {
    const member = database.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND account_id = ?').get(scenario.workspaceId, account.id);
    if (member) return member.role === 'viewer' ? 'viewer' : 'editor';
  }
  return null;
}

function hasPermission(actual, minimum) {
  const rank = { viewer: 1, editor: 2, owner: 3 };
  return (rank[actual] || 0) >= (rank[minimum] || 0);
}

function listVisibleScenarios(database, accountId) {
  return database.prepare(`SELECT DISTINCT sc.id, sc.owner_id AS ownerId, sc.workspace_id AS workspaceId, sc.name, sc.notes, sc.state_json AS stateJson, sc.saved_at AS savedAt
    FROM scenarios sc
    LEFT JOIN scenario_permissions sp ON sp.scenario_id = sc.id AND sp.account_id = ?
    LEFT JOIN workspace_members wm ON wm.workspace_id = sc.workspace_id AND wm.account_id = ?
    WHERE sc.owner_id = ? OR sp.account_id = ? OR wm.account_id = ?
    ORDER BY sc.saved_at DESC`).all(accountId, accountId, accountId, accountId, accountId);
}

function listWorkspaces(database, accountId) {
  return database.prepare(`SELECT w.id, w.name, w.created_at AS createdAt, wm.role FROM workspaces w JOIN workspace_members wm ON wm.workspace_id = w.id WHERE wm.account_id = ? ORDER BY w.created_at`).all(accountId);
}

function defaultWorkspace(database, accountId) {
  return database.prepare('SELECT workspace_id AS id FROM workspace_members WHERE account_id = ? ORDER BY role = ? DESC').get(accountId, 'owner')?.id || null;
}

function assertWorkspaceMember(database, workspaceId, accountId) {
  if (!database.prepare('SELECT role FROM workspace_members WHERE workspace_id = ? AND account_id = ?').get(workspaceId, accountId)) throw httpError(403, 'Not a workspace member');
}

function saveVersion(database, scenarioId, state, savedAt) {
  database.prepare('INSERT INTO scenario_versions (id, scenario_id, state_json, saved_at) VALUES (?, ?, ?, ?)').run(crypto.randomUUID(), scenarioId, JSON.stringify(state || {}), savedAt);
}

function notify(database, accountId, kind, message, skipId = null) {
  if (!accountId || accountId === skipId) return;
  database.prepare('INSERT INTO notifications (id, account_id, kind, message, created_at) VALUES (?, ?, ?, ?, ?)').run(crypto.randomUUID(), accountId, kind, message, new Date().toISOString());
}

function publicModel(database) {
  const feedback = database.prepare('SELECT predicted, actual FROM model_feedback').all();
  const total = feedback.length;
  const correct = feedback.filter((row) => row.predicted === row.actual).length;
  return {
    modelVersion: liveModel?.model_version || '0.5-local',
    samples: liveModel?.samples || 0,
    testAccuracy: liveModel?.test_accuracy ?? null,
    feedbackSamples: total,
    feedbackAccuracy: total ? Number((correct / total).toFixed(3)) : null,
  };
}

function actionFromPlay(playId) {
  if (playId === 'carry-forward') return 'Carry';
  if (playId === 'safe-recycle') return 'Other';
  return 'Pass';
}

function retrainFromFeedback(database, model) {
  if (!model) return null;
  const samples = database.prepare('SELECT actual, features_json AS featuresJson FROM model_feedback').all()
    .map((row) => ({ label: actionFromPlay(row.actual), features: JSON.parse(row.featuresJson || '[]') }))
    .filter((sample) => sample.features.length === 9 && sample.features.every(Number.isFinite));
  return samples.length ? retrainModel(model, samples) : model;
}

function validateScenarioState(state) {
  if (!state || typeof state !== 'object') throw httpError(400, 'state must be an object');
  const players = Array.isArray(state.players) ? state.players : [];
  const counts = new Map();
  for (const player of players) {
    const team = player.team || 'home';
    const count = counts.get(team) || 0;
    if (count >= MAX_PLAYERS_PER_TEAM) throw httpError(400, `A team cannot have more than ${MAX_PLAYERS_PER_TEAM} players`);
    counts.set(team, count + 1);
  }
}

function readToken(request) { return (request.headers.cookie || '').split(';').map((cookie) => cookie.trim().split('=')).find(([name]) => name === 'playmaker_session')?.[1]; }
function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) { return `${salt}:${crypto.scryptSync(password, salt, 64).toString('hex')}`; }
function verifyPassword(password, stored) { const [salt, expected] = String(stored).split(':'); if (!salt || !expected) return false; const actual = crypto.scryptSync(String(password || ''), salt, 64).toString('hex'); return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected)); }
function publicAccount(account, database) {
  const payload = { id: account.id, name: account.name, email: account.email, createdAt: account.createdAt, emailVerified: Boolean(account.emailVerified) };
  if (database) payload.workspaces = listWorkspaces(database, account.id);
  return payload;
}
function publicScenario(scenario) { return { id: scenario.id, name: scenario.name, notes: scenario.notes || '', state: typeof scenario.stateJson === 'string' ? JSON.parse(scenario.stateJson) : scenario.state, savedAt: scenario.savedAt, ownerId: scenario.ownerId, workspaceId: scenario.workspaceId || null }; }
function requiredText(value, field) { if (typeof value !== 'string' || !value.trim()) throw httpError(400, `${field} is required`); return value.trim(); }
function normalizeEmail(value) { const email = requiredText(value, 'email').toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'email must be valid'); return email; }
function httpError(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }

function readJson(request) { return new Promise((resolve, reject) => { let content = ''; request.on('data', (chunk) => { content += chunk; if (content.length > 1_000_000) reject(httpError(413, 'Request body is too large')); }); request.on('end', () => { try { resolve(content ? JSON.parse(content) : {}); } catch { reject(httpError(400, 'Invalid JSON')); } }); request.on('error', reject); }); }
function writeJson(response, statusCode, value) { response.statusCode = statusCode; if (statusCode === 204) return response.end(); response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(value)); }
function serveStatic(response, requestPath) { const relative = requestPath === '/' ? 'index.html' : requestPath.slice(1); const filePath = path.resolve(ROOT, relative); if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return writeJson(response, 404, { error: 'Not found' }); const extension = path.extname(filePath); response.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml; charset=utf-8' }[extension] || 'application/octet-stream'); response.end(fs.readFileSync(filePath)); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const requestedPort = Number(process.env.PORT || 4173);
  try {
    liveModel = JSON.parse(fs.readFileSync(path.join(ROOT, 'model', 'model.json'), 'utf8'));
  } catch { liveModel = null; }
  const listen = (port) => {
    const server = createServer({ model: liveModel });
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') { server.close(); return listen(port + 1); }
      throw error;
    });
    server.listen(port, () => console.log(`Playmaker server listening on http://localhost:${port}`));
  };
  listen(requestedPort);
}
