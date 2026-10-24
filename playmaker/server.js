import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { MAX_PLAYERS_PER_TEAM } from './analysis.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_DATABASE = path.join(ROOT, 'data', 'playmaker.sqlite');
const SESSION_DAYS = 7;

export function createServer({ databasePath = process.env.PLAYMAKER_DATABASE || DEFAULT_DATABASE } = {}) {
  const database = createDatabase(databasePath);
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
  const body = ['POST', 'PUT', 'PATCH'].includes(request.method) ? await readJson(request) : {};
  if (request.method === 'GET' && url.pathname === '/api/health') return writeJson(response, 200, { status: 'ok' });
  if (request.method === 'POST' && url.pathname === '/api/auth/register') {
    const name = requiredText(body.name, 'name');
    const email = normalizeEmail(body.email);
    const password = requiredText(body.password, 'password');
    if (password.length < 8) throw httpError(400, 'Password must be at least 8 characters');
    if (database.prepare('SELECT id FROM accounts WHERE email = ?').get(email)) throw httpError(409, 'An account with this email already exists');
    const account = { id: crypto.randomUUID(), name, email, password: hashPassword(password), createdAt: new Date().toISOString() };
    database.prepare('INSERT INTO accounts (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)').run(account.id, account.name, account.email, account.password, account.createdAt);
    return authenticate(response, database, account);
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/login') {
    const email = normalizeEmail(body.email);
    const account = database.prepare('SELECT id, name, email, password_hash AS password, created_at AS createdAt FROM accounts WHERE email = ?').get(email);
    if (!account || !verifyPassword(body.password, account.password)) throw httpError(401, 'Invalid email or password');
    return authenticate(response, database, account);
  }
  if (request.method === 'POST' && url.pathname === '/api/auth/logout') {
    const token = readToken(request);
    if (token) database.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    response.setHeader('Set-Cookie', 'playmaker_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0');
    return writeJson(response, 204, null);
  }
  const account = requireAccount(request, database);
  if (request.method === 'GET' && url.pathname === '/api/me') return writeJson(response, 200, publicAccount(account));
  if (request.method === 'PATCH' && url.pathname === '/api/me') {
    const name = body.name === undefined ? account.name : requiredText(body.name, 'name');
    const email = body.email === undefined ? account.email : normalizeEmail(body.email);
    try { database.prepare('UPDATE accounts SET name = ?, email = ? WHERE id = ?').run(name, email, account.id); } catch (error) { if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') throw httpError(409, 'An account with this email already exists'); throw error; }
    return writeJson(response, 200, publicAccount({ ...account, name, email }));
  }
  if (url.pathname === '/api/scenarios' && request.method === 'GET') {
    const rows = database.prepare('SELECT id, name, state_json AS stateJson, saved_at AS savedAt FROM scenarios WHERE owner_id = ? ORDER BY saved_at DESC').all(account.id);
    return writeJson(response, 200, rows.map(publicScenario));
  }
  if (url.pathname === '/api/scenarios' && request.method === 'POST') {
    validateScenarioState(body.state);
    const scenario = { id: crypto.randomUUID(), ownerId: account.id, name: requiredText(body.name, 'name'), state: body.state || {}, savedAt: new Date().toISOString() };
    database.prepare('INSERT INTO scenarios (id, owner_id, name, state_json, saved_at) VALUES (?, ?, ?, ?, ?)').run(scenario.id, scenario.ownerId, scenario.name, JSON.stringify(scenario.state), scenario.savedAt);
    return writeJson(response, 201, scenario);
  }
  const scenarioMatch = url.pathname.match(/^\/api\/scenarios\/([^/]+)$/);
  if (scenarioMatch) {
    const row = database.prepare('SELECT id, owner_id AS ownerId, name, state_json AS stateJson, saved_at AS savedAt FROM scenarios WHERE id = ? AND owner_id = ?').get(scenarioMatch[1], account.id);
    if (!row) throw httpError(404, 'Scenario not found');
    if (request.method === 'GET') return writeJson(response, 200, publicScenario(row));
    if (request.method === 'DELETE') {
      database.prepare('DELETE FROM scenarios WHERE id = ? AND owner_id = ?').run(row.id, account.id);
      return writeJson(response, 204, null);
    }
  }
  throw httpError(404, 'Route not found');
}

function createDatabase(filePath) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  database.exec(`PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS accounts (id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL, created_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS scenarios (id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, name TEXT NOT NULL, state_json TEXT NOT NULL, saved_at TEXT NOT NULL);
    CREATE INDEX IF NOT EXISTS idx_sessions_account ON sessions(account_id);
    CREATE INDEX IF NOT EXISTS idx_scenarios_owner_saved ON scenarios(owner_id, saved_at DESC);`);
  return database;
}

function authenticate(response, database, account) {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  database.prepare('INSERT INTO sessions (token, account_id, expires_at) VALUES (?, ?, ?)').run(token, account.id, expiresAt);
  response.setHeader('Set-Cookie', `playmaker_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 86400}`);
  return writeJson(response, 200, publicAccount(account));
}

function requireAccount(request, database) {
  const token = readToken(request);
  if (!token) throw httpError(401, 'Authentication required');
  const account = database.prepare(`SELECT a.id, a.name, a.email, a.created_at AS createdAt FROM accounts a JOIN sessions s ON s.account_id = a.id WHERE s.token = ? AND s.expires_at > ?`).get(token, new Date().toISOString());
  if (!account) throw httpError(401, 'Authentication required');
  return account;
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
function publicAccount(account) { return { id: account.id, name: account.name, email: account.email, createdAt: account.createdAt }; }
function publicScenario(scenario) { return { id: scenario.id, name: scenario.name, state: typeof scenario.stateJson === 'string' ? JSON.parse(scenario.stateJson) : scenario.state, savedAt: scenario.savedAt }; }
function requiredText(value, field) { if (typeof value !== 'string' || !value.trim()) throw httpError(400, `${field} is required`); return value.trim(); }
function normalizeEmail(value) { const email = requiredText(value, 'email').toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) throw httpError(400, 'email must be valid'); return email; }
function httpError(statusCode, message) { return Object.assign(new Error(message), { statusCode }); }

function readJson(request) { return new Promise((resolve, reject) => { let content = ''; request.on('data', (chunk) => { content += chunk; if (content.length > 1_000_000) reject(httpError(413, 'Request body is too large')); }); request.on('end', () => { try { resolve(content ? JSON.parse(content) : {}); } catch { reject(httpError(400, 'Invalid JSON')); } }); request.on('error', reject); }); }
function writeJson(response, statusCode, value) { response.statusCode = statusCode; if (statusCode === 204) return response.end(); response.setHeader('Content-Type', 'application/json; charset=utf-8'); response.end(JSON.stringify(value)); }
function serveStatic(response, requestPath) { const relative = requestPath === '/' ? 'index.html' : requestPath.slice(1); const filePath = path.resolve(ROOT, relative); if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return writeJson(response, 404, { error: 'Not found' }); const extension = path.extname(filePath); response.setHeader('Content-Type', { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8' }[extension] || 'application/octet-stream'); response.end(fs.readFileSync(filePath)); }

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const requestedPort = Number(process.env.PORT || 4173);
  const listen = (port) => {
    const server = createServer();
    server.once('error', (error) => {
      if (error.code === 'EADDRINUSE') { server.close(); return listen(port + 1); }
      throw error;
    });
    server.listen(port, () => console.log(`Playmaker server listening on http://localhost:${port}`));
  };
  listen(requestedPort);
}
