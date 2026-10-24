import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createServer } from './server.js';

let server;
let baseUrl;
let databasePath;

test.before(async () => {
  databasePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'playmaker-')), 'db.json');
  server = createServer({ databasePath });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test('rejects protected requests without a session', async () => {
  const response = await request('/api/me');
  assert.equal(response.status, 401);
});

test('reports a healthy deployment without authentication', async () => {
  const response = await request('/api/health');
  assert.equal(response.status, 200);
  assert.deepEqual(response.body, { status: 'ok' });
});

test('registers an account, persists it, and returns a session cookie', async () => {
  const response = await request('/api/auth/register', { method: 'POST', body: { name: 'Jamie Morgan', email: 'jamie@example.test', password: 'correct horse battery staple' } });
  assert.equal(response.status, 200);
  assert.equal(response.body.email, 'jamie@example.test');
  assert.match(response.headers.get('set-cookie'), /playmaker_session=/);
  const database = new DatabaseSync(databasePath);
  assert.equal(database.prepare('SELECT COUNT(*) AS count FROM accounts').get().count, 1);
  database.close();
});

test('creates, lists, loads, and deletes an owned scenario', async () => {
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'correct horse battery staple' } });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const created = await request('/api/scenarios', { method: 'POST', cookie, body: { name: 'Right-side overload', state: { risk: 72, players: [] } } });
  assert.equal(created.status, 201);
  const listed = await request('/api/scenarios', { cookie });
  assert.equal(listed.body.length, 1);
  const loaded = await request(`/api/scenarios/${created.body.id}`, { cookie });
  assert.equal(loaded.body.name, 'Right-side overload');
  const removed = await request(`/api/scenarios/${created.body.id}`, { method: 'DELETE', cookie });
  assert.equal(removed.status, 204);
  assert.deepEqual((await request('/api/scenarios', { cookie })).body, []);
});

test('does not accept invalid passwords', async () => {
  const response = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'wrong-password' } });
  assert.equal(response.status, 401);
});

test('logs out and invalidates the session', async () => {
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'correct horse battery staple' } });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const logout = await request('/api/auth/logout', { method: 'POST', cookie });
  assert.equal(logout.status, 204);
  assert.match(logout.headers.get('set-cookie'), /Max-Age=0/);
  assert.equal((await request('/api/me', { cookie })).status, 401);
});

test('rejects scenarios with more than eleven players for one team', async () => {
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'correct horse battery staple' } });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const players = Array.from({ length: 12 }, (_, index) => ({ id: String(index), x: 0.2, y: 0.5 }));
  const response = await request('/api/scenarios', { method: 'POST', cookie, body: { name: 'Invalid shape', state: { players } } });
  assert.equal(response.status, 400);
  assert.match(response.body.error, /11 players/);
});

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, { method: options.method || 'GET', headers: { ...(options.cookie ? { Cookie: options.cookie } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
}