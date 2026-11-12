import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';
import { registerAndVerify, TEST_CAPTCHA, TEST_PASSWORD, TEST_VERIFICATION_CODE } from './helpers/auth.js';
import { createOnlineMatch } from './helpers/online.js';

let counter = 0;

async function createPlayer(label) {
  counter += 1;
  return registerAndVerify(app, {
    email: `${label}_${Date.now()}_${counter}@security.test`,
    displayName: `${label}${counter}`
  });
}

test('Protected routes reject missing and tampered bearer tokens', async () => {
  const anonymous = await request(app).get('/api/auth/me');
  assert.equal(anonymous.status, 401);

  const { token } = await createPlayer('TokenPlayer');
  const tampered = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}x`);
  assert.equal(tampered.status, 403);
});

test('A regular player cannot reach admin endpoints', async () => {
  const { token } = await createPlayer('RegularPlayer');

  const users = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(users.status, 403);

  const clear = await request(app)
    .delete('/api/admin/leaderboards')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(clear.status, 403);
});

test('Profile updates cannot grant credits or administrator rights', async () => {
  const { token } = await createPlayer('Escalation');

  const update = await request(app)
    .patch('/api/auth/me')
    .set('Authorization', `Bearer ${token}`)
    .send({
      displayName: 'Escalation',
      credits: 9_999_999,
      is_admin: true
    });

  assert.equal(update.status, 200);
  assert.equal(update.body.credits, 0);
  assert.equal(update.body.is_admin, false);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(me.body.credits, 0);
  assert.equal(me.body.is_admin, false);
});

test('An unverified account cannot sign in', async () => {
  const email = `unverified_${Date.now()}@security.test`;
  const registration = await request(app).post('/api/auth/register').send({
    email,
    password: TEST_PASSWORD,
    displayName: 'Unverified',
    captchaToken: TEST_CAPTCHA
  });
  assert.equal(registration.status, 201);

  const login = await request(app).post('/api/auth/login').send({
    identifier: email,
    password: TEST_PASSWORD
  });
  assert.equal(login.status, 403);
  assert.equal(login.body.code, 'EMAIL_NOT_VERIFIED');
});

test('Verification codes lock after too many incorrect attempts', async () => {
  const email = `bruteforce_${Date.now()}@security.test`;
  await request(app).post('/api/auth/register').send({
    email,
    password: TEST_PASSWORD,
    displayName: 'CodeBrute',
    captchaToken: TEST_CAPTCHA
  });

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const wrong = await request(app)
      .post('/api/auth/verify-email')
      .send({ email, code: '000000' });
    assert.equal(wrong.status, 400);
  }

  const correctAfterLock = await request(app)
    .post('/api/auth/verify-email')
    .send({ email, code: TEST_VERIFICATION_CODE });
  assert.equal(correctAfterLock.status, 400);
  assert.match(correctAfterLock.body.error, /Too many incorrect attempts/i);
});

test('Impossible scores are marked unverified and never reach the leaderboard', async () => {
  const { token } = await createPlayer('ScoreForger');

  const overMaximum = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'marathon_150',
      score: 3_000_001,
      lines: 1,
      level: 1,
      duration: 1_000,
      piecesPlaced: 12
    });
  assert.equal(overMaximum.status, 201);
  assert.equal(overMaximum.body.verified, false);
  assert.equal(overMaximum.body.creditsAwarded, 0);

  const impossibleSprint = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'sprint_40',
      score: 1000,
      lines: 40,
      level: 1,
      duration: 2_000,
      piecesPlaced: 80
    });
  assert.equal(impossibleSprint.status, 201);
  assert.equal(impossibleSprint.body.verified, false);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  const leaderboard = await request(app).get('/api/leaderboards/marathon_150');
  assert.equal(leaderboard.body.entries.some((entry) => entry.user_id === me.body.id), false);
});

test('A player cannot equip a shop item they do not own', async () => {
  const { token } = await createPlayer('ShopAttacker');
  const shop = await request(app)
    .get('/api/shop')
    .set('Authorization', `Bearer ${token}`);

  const unowned = shop.body.items.find((item) => !item.owned && item.price > 0);
  assert.ok(unowned, 'the test shop should contain a purchasable item');

  const equip = await request(app)
    .post('/api/shop/equip')
    .set('Authorization', `Bearer ${token}`)
    .send({ itemId: unowned.id });
  assert.equal(equip.status, 403);
});

test('A player cannot join their own server-created online match', async () => {
  const { token } = await createPlayer('SelfMatch');
  const created = await request(app)
    .post('/api/matches/online')
    .set('Authorization', `Bearer ${token}`)
    .send({ ranked: true });
  assert.equal(created.status, 201);

  const join = await request(app)
    .post(`/api/matches/online/${created.body.matchId}/join`)
    .set('Authorization', `Bearer ${token}`)
    .send({});
  assert.equal(join.status, 400);
});

test('A third player cannot report a result inside someone else\'s match', async () => {
  const host = await createPlayer('MatchHost');
  const guest = await createPlayer('MatchGuest');
  const outsider = await createPlayer('MatchOutsider');
  const { matchId } = await createOnlineMatch(app, host.token, guest.token, { ranked: true });

  const forged = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${outsider.token}`)
    .send({
      opponentType: 'human',
      matchId,
      result: 'win',
      duration: 1000,
      playerScore: 1000,
      playerLines: 10,
      piecesPlaced: 20
    });

  assert.equal(forged.status, 403);
});

test('A forfeit ignores leaver-supplied opponent values and awards no credits', async () => {
  const winner = await createPlayer('ForfeitWinner');
  const loser = await createPlayer('ForfeitLoser');
  const { matchId } = await createOnlineMatch(app, winner.token, loser.token, { ranked: false });

  const forfeit = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${loser.token}`)
    .send({
      matchId,
      result: 'loss',
      duration: 1000,
      playerLines: 3,
      opponentLines: 9999,
      opponentName: 'Invented Opponent'
    });
  assert.equal(forfeit.status, 201);

  const winnerMe = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${winner.token}`);
  assert.equal(winnerMe.body.credits, 0);

  const winnerStats = await request(app)
    .get('/api/stats/me')
    .set('Authorization', `Bearer ${winner.token}`);
  assert.equal(winnerStats.body.stats.wins, 1);
  assert.equal(winnerStats.body.stats.total_lines, 0);
});

test('A client cannot upgrade a casual server match to ranked', async () => {
  const host = await createPlayer('CasualHost');
  const guest = await createPlayer('CasualGuest');
  const { matchId } = await createOnlineMatch(app, host.token, guest.token, { ranked: false });

  const report = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${host.token}`)
    .send({
      matchId,
      opponentType: 'human',
      ranked: true,
      result: 'win',
      duration: 1000,
      playerScore: 1000,
      playerLines: 10,
      piecesPlaced: 20
    });

  assert.equal(report.status, 201);
  assert.equal(report.body.ranked, false);
});

test('Rematches are server-issued only after a completed match', async () => {
  const host = await createPlayer('RematchHost');
  const guest = await createPlayer('RematchGuest');
  const { matchId } = await createOnlineMatch(app, host.token, guest.token, { ranked: true });

  const early = await request(app)
    .post(`/api/matches/online/${matchId}/rematch`)
    .set('Authorization', `Bearer ${host.token}`)
    .send({});
  assert.equal(early.status, 409);

  const win = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${host.token}`)
    .send({ matchId, opponentType: 'human', result: 'win', duration: 1000, playerLines: 1, piecesPlaced: 10 });
  assert.equal(win.status, 201);

  const loss = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${guest.token}`)
    .send({ matchId, opponentType: 'human', result: 'loss', duration: 1000, playerLines: 0, piecesPlaced: 10 });
  assert.equal(loss.status, 201);

  const rematch = await request(app)
    .post(`/api/matches/online/${matchId}/rematch`)
    .set('Authorization', `Bearer ${host.token}`)
    .send({});
  assert.equal(rematch.status, 201);
  assert.notEqual(rematch.body.matchId, matchId);
  assert.equal(rematch.body.ranked, true);
});

test('Logout revokes the current session token', async () => {
  const { token } = await createPlayer('LogoutPlayer');

  const logout = await request(app)
    .post('/api/auth/logout')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(logout.status, 200);

  const reused = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(reused.status, 401);
});
