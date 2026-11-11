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
  assert.equal(regRes.body.user.display_name, displayName);

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
    .send({
      das: 120,
      arr: 5,
      theme: 'light-01',
      keybindings: { moveLeft: [37], hardDrop: [32] },
      gamepad_bindings: { hold: [4] }
    });
  assert.equal(settingsRes.status, 200);
  assert.equal(settingsRes.body.das, 120);
  assert.equal(settingsRes.body.theme, 'light-01');

  // Partial updates must preserve the other fields (including JSON bindings).
  const partialSettings = await request(app)
    .put('/api/settings')
    .set('Authorization', `Bearer ${token}`)
    .send({ das: 100 });
  assert.equal(partialSettings.status, 200);
  assert.equal(partialSettings.body.das, 100);
  assert.equal(partialSettings.body.arr, 5);
  assert.equal(partialSettings.body.theme, 'light-01');
  assert.deepEqual(partialSettings.body.keybindings, { moveLeft: [37], hardDrop: [32] });
  assert.deepEqual(partialSettings.body.gamepad_bindings, { hold: [4] });

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

test('Login accepts email or username and usernames stay unique', async () => {
  const stamp = Date.now();
  const username = `player_${stamp}`;
  const email = `login_${stamp}@example.com`;

  const reg = await request(app).post('/api/auth/register').send({
    email,
    password: 'password123',
    displayName: 'Login Player',
    username
  });
  assert.equal(reg.status, 201);
  assert.equal(reg.body.user.username, username);

  const byUsername = await request(app).post('/api/auth/login').send({
    identifier: username.toUpperCase(),
    password: 'password123'
  });
  assert.equal(byUsername.status, 200);
  assert.equal(byUsername.body.user.email, email);

  const byEmail = await request(app).post('/api/auth/login').send({
    email,
    password: 'password123'
  });
  assert.equal(byEmail.status, 200);

  const wrongPassword = await request(app).post('/api/auth/login').send({
    identifier: username,
    password: 'wrong-password'
  });
  assert.equal(wrongPassword.status, 401);

  const duplicate = await request(app).post('/api/auth/register').send({
    email: `other_${stamp}@example.com`,
    password: 'password123',
    displayName: 'Other Player',
    username
  });
  assert.equal(duplicate.status, 409);
});

test('Anti-cheat rejects physically impossible scores or pps', async () => {
  const email = `cheat_${Date.now()}@example.com`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password: 'password123', displayName: 'Hacker' });
  const token = regRes.body.token;

  // Impossible PPS: 100 pieces in 2 seconds
  const cheatRes = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'sprint_40',
      score: 999999,
      lines: 40,
      duration: 2000,
      piecesPlaced: 100,
      pps: 50
    });
  assert.equal(cheatRes.status, 201);
  assert.equal(cheatRes.body.verified, false);
});

test('Server validates modes and recomputes PPS/APM instead of trusting the client', async () => {
  const email = `validation_${Date.now()}@example.com`;
  const password = 'password123';
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email, password, displayName: 'Validator' });
  const token = regRes.body.token;

  // Unknown mode is rejected with a 400
  const unknownMode = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({ mode: 'not_a_mode', duration: 20000, score: 1000, lines: 5, piecesPlaced: 20 });
  assert.equal(unknownMode.status, 400);

  // Sprint submissions must contain exactly 40 lines
  const invalidSprint = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({ mode: 'sprint_40', duration: 60000, score: 1000, lines: 12, piecesPlaced: 30 });
  assert.equal(invalidSprint.status, 201);
  assert.equal(invalidSprint.body.verified, false);

  // Valid result: client-supplied pps/apm are ignored and recomputed
  const valid = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'marathon_150',
      duration: 20000,
      score: 5000,
      lines: 8,
      level: 1,
      piecesPlaced: 20,
      pps: 999,
      apm: 999
    });
  assert.equal(valid.status, 201);
  assert.equal(valid.body.verified, true);

  const history = await request(app)
    .get('/api/results/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(history.status, 200);
  assert.equal(history.body[0].pps, 1);
  assert.equal(history.body[0].apm, 24);
});

test('Stats for an unknown user return 404', async () => {
  const res = await request(app).get('/api/stats/00000000-0000-4000-8000-000000000000');
  assert.equal(res.status, 404);
});
