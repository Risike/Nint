import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';

test('Health check endpoint returns status ok', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('Auth flow: register, me, settings, and result submission', async () => {
  const email = `test_${Date.now()}@example.com`;
  const password = 'Password123!';
  const displayName = 'NintMaster';

  // 1. Register
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName });

  assert.equal(regRes.status, 201);
  assert.ok(regRes.body.token);
  assert.equal(regRes.body.user.email, email);

  const token = regRes.body.token;

  // 2. Get Me
  const meRes = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(meRes.status, 200);
  assert.equal(meRes.body.display_name, displayName);

  // 3. Update Settings
  const settingsRes = await request(app)
    .put('/api/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ das: 120, arr: 5, theme: 'light' });
  assert.equal(settingsRes.status, 200);
  assert.equal(settingsRes.body.das, 120);
  assert.equal(settingsRes.body.theme, 'light');

  // 4. Submit Game Result
  const resultRes = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'marathon_150',
      score: 12500,
      lines: 24,
      level: 3,
      duration: 45000,
      piecesPlaced: 35,
      pps: 0.77,
      apm: 18.5,
      tetrises: 3,
      tSpins: 1,
      maxCombo: 3
    });
  assert.equal(resultRes.status, 201);
  assert.equal(resultRes.body.verified, true);

  // 5. Query Leaderboard
  const lbRes = await request(app)
    .get('/api/leaderboards/marathon_150');
  assert.equal(lbRes.status, 200);
  assert.ok(lbRes.body.entries.length >= 1);
  assert.equal(lbRes.body.entries[0].score, 12500);

  // 6. Query Stats
  const statsRes = await request(app)
    .get('/api/stats/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(statsRes.status, 200);
  assert.equal(statsRes.body.stats.total_lines, 24);
  assert.equal(statsRes.body.stats.total_tetrises, 3);
});

test('Anti-cheat rejects physically impossible scores or pps', async () => {
  const email = `cheat_${Date.now()}@example.com`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', displayName: 'Hacker' });
  const token = regRes.body.token;

  // Impossible PPS: 50 pieces in 1 second
  const cheatRes = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'sprint_40',
      score: 999999,
      lines: 40,
      duration: 2000, // 2 seconds
      piecesPlaced: 100,
      pps: 50
    });
  assert.equal(cheatRes.status, 201);
  assert.equal(cheatRes.body.verified, false);
});
