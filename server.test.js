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

test('resets a password after a forgot-password request', async () => {
  const forgot = await request('/api/auth/forgot-password', { method: 'POST', body: { email: 'jamie@example.test' } });
  assert.equal(forgot.status, 200);
  const database = new DatabaseSync(databasePath);
  const token = database.prepare('SELECT reset_token AS token FROM accounts WHERE email = ?').get('jamie@example.test').token;
  database.close();
  assert.ok(token);
  const reset = await request('/api/auth/reset-password', { method: 'POST', body: { token, password: 'new horse battery staple' } });
  assert.equal(reset.status, 200);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'correct horse battery staple' } })).status, 401);
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'new horse battery staple' } });
  assert.equal(login.status, 200);
});

test('verifies email from the stored token', async () => {
  const database = new DatabaseSync(databasePath);
  const token = database.prepare('SELECT verification_token AS token FROM accounts WHERE email = ?').get('jamie@example.test').token;
  database.close();
  const response = await request('/api/auth/verify-email', { method: 'POST', body: { token } });
  assert.equal(response.status, 200);
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'new horse battery staple' } });
  assert.equal(login.body.emailVerified, true);
});

test('shares a scenario, accepts comments, and duplicates it', async () => {
  const owner = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'new horse battery staple' } });
  const ownerCookie = owner.headers.get('set-cookie').split(';')[0];
  const created = await request('/api/scenarios', { method: 'POST', cookie: ownerCookie, body: { name: 'Shared press', notes: 'Wide overload', state: { risk: 40, players: [] } } });
  const share = await request(`/api/scenarios/${created.body.id}/share`, { method: 'POST', cookie: ownerCookie, body: { permission: 'viewer' } });
  assert.equal(share.status, 201);
  const publicView = await request(share.body.url);
  assert.equal(publicView.status, 200);
  assert.equal(publicView.body.name, 'Shared press');
  const comment = await request(`/api/scenarios/${created.body.id}/comments`, { method: 'POST', cookie: ownerCookie, body: { body: 'Hold the weak-side 8.' } });
  assert.equal(comment.status, 201);
  const comments = await request(`/api/scenarios/${created.body.id}/comments`, { cookie: ownerCookie });
  assert.equal(comments.body.length, 1);
  const copy = await request(`/api/scenarios/${created.body.id}/duplicate`, { method: 'POST', cookie: ownerCookie });
  assert.equal(copy.status, 201);
  assert.match(copy.body.name, /copy/);
  assert.equal(copy.body.state.risk, 40);
  const report = await request(`/api/scenarios/${created.body.id}/report`, { cookie: ownerCookie });
  assert.equal(report.status, 200);
  assert.match(report.body.text, /Shared press/);
  assert.match(report.body.text, /Wide overload/);
  const versions = await request(`/api/scenarios/${created.body.id}/versions`, { cookie: ownerCookie });
  assert.ok(versions.body.length >= 1);
});

test('adds a workspace member and collaborator permissions', async () => {
  const guest = await request('/api/auth/register', { method: 'POST', body: { name: 'Alex Rivera', email: 'alex@example.test', password: 'another long password' } });
  const owner = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'new horse battery staple' } });
  const ownerCookie = owner.headers.get('set-cookie').split(';')[0];
  const workspaces = await request('/api/workspaces', { cookie: ownerCookie });
  const member = await request(`/api/workspaces/${workspaces.body[0].id}/members`, { method: 'POST', cookie: ownerCookie, body: { email: 'alex@example.test', role: 'editor' } });
  assert.equal(member.status, 201);
  const listed = await request('/api/scenarios', { cookie: ownerCookie });
  const shareWithUser = await request(`/api/scenarios/${listed.body[0].id}/collaborators`, { method: 'POST', cookie: ownerCookie, body: { email: 'alex@example.test', permission: 'viewer' } });
  assert.equal(shareWithUser.status, 201);
  const guestCookie = guest.headers.get('set-cookie').split(';')[0];
  const visible = await request('/api/scenarios', { cookie: guestCookie });
  assert.ok(visible.body.some((scenario) => scenario.name.includes('press') || scenario.name.includes('Shared')));
  const sharedScenario = visible.body.find((scenario) => scenario.name.includes('press') || scenario.name.includes('Shared'));
  const comment = await request(`/api/scenarios/${sharedScenario.id}/comments`, { method: 'POST', cookie: guestCookie, body: { body: 'Review the far-side spacing.' } });
  assert.equal(comment.status, 201);
  const ownerNotifications = await request('/api/notifications', { cookie: ownerCookie });
  assert.ok(ownerNotifications.body.some((item) => item.kind === 'comment'));
});

test('records model feedback and lists notifications', async () => {
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'jamie@example.test', password: 'new horse battery staple' } });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const feedback = await request('/api/model/feedback', { method: 'POST', cookie, body: { predicted: 'safe-recycle', actual: 'progressive-pass', features: [0.4, 0.5, 0.6, 0.8, 0.4, 0.6, 0, 1, 0] } });
  assert.equal(feedback.status, 201);
  const invalidFeedback = await request('/api/model/feedback', { method: 'POST', cookie, body: { predicted: 'bogus', actual: 'progressive-pass', features: [] } });
  assert.equal(invalidFeedback.status, 400);
  const completed = await request('/api/analysis/completed', { method: 'POST', cookie, body: { scenarioName: 'Right overload', recommendation: 'Progressive pass' } });
  assert.equal(completed.status, 204);
  const notifications = await request('/api/notifications', { cookie });
  assert.ok(notifications.body.length >= 1);
  assert.ok(notifications.body.some((item) => item.message.includes('Right overload')));
  const model = await request('/api/model');
  assert.equal(model.status, 200);
  assert.ok(model.body.feedbackSamples >= 1);
});

test('deletes an account after password confirmation', async () => {
  const login = await request('/api/auth/login', { method: 'POST', body: { email: 'alex@example.test', password: 'another long password' } });
  const cookie = login.headers.get('set-cookie').split(';')[0];
  const removed = await request('/api/me', { method: 'DELETE', cookie, body: { password: 'another long password' } });
  assert.equal(removed.status, 204);
  assert.equal((await request('/api/auth/login', { method: 'POST', body: { email: 'alex@example.test', password: 'another long password' } })).status, 401);
});

async function request(route, options = {}) {
  const response = await fetch(`${baseUrl}${route}`, { method: options.method || 'GET', headers: { ...(options.cookie ? { Cookie: options.cookie } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  return { status: response.status, headers: response.headers, body: response.status === 204 ? null : await response.json() };
}
