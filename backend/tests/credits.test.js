import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';
import { registerAndVerify } from './helpers/auth.js';
import { createOnlineMatch } from './helpers/online.js';

async function register(label) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const displayName = `${label.replace(/[^A-Za-z0-9]/g, '')}${stamp.slice(-4)}`;
  return registerAndVerify(app, {
    email: `${label}_${stamp}@test.com`,
    displayName
  });
}

async function getCredits(token) {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  return res.body.credits;
}

test('Verified lines in scored solo modes credit the account, Zen does not', async () => {
  const { token, user } = await register('credits_solo');
  assert.equal(user.credits, 0);
  assert.equal(await getCredits(token), 0);

  const marathon = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'marathon_150',
      score: 1000,
      lines: 5,
      level: 1,
      duration: 10000,
      piecesPlaced: 12
    });
  assert.equal(marathon.status, 201);
  assert.equal(marathon.body.verified, true);
  assert.equal(marathon.body.creditsAwarded, 5);
  assert.equal(await getCredits(token), 5);

  const sprint = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'sprint_40',
      score: 5000,
      lines: 40,
      level: 1,
      duration: 20000,
      piecesPlaced: 80
    });
  assert.equal(sprint.status, 201);
  assert.equal(sprint.body.verified, true);
  assert.equal(sprint.body.creditsAwarded, 40);
  assert.equal(await getCredits(token), 45);

  const ultra = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'ultra_3m',
      score: 2000,
      lines: 12,
      level: 1,
      duration: 30000,
      piecesPlaced: 30
    });
  assert.equal(ultra.status, 201);
  assert.equal(ultra.body.verified, true);
  assert.equal(ultra.body.creditsAwarded, 12);
  assert.equal(await getCredits(token), 57);

  const boss = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'boss_attack',
      score: 7000,
      lines: 7,
      level: 1,
      duration: 12000,
      piecesPlaced: 20
    });
  assert.equal(boss.status, 201);
  assert.equal(boss.body.verified, true);
  assert.equal(boss.body.creditsAwarded, 7);
  assert.equal(await getCredits(token), 64);

  const bossLeaderboard = await request(app).get('/api/leaderboards/boss_attack');
  assert.equal(bossLeaderboard.status, 400);

  const zen = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'zen',
      score: 0,
      lines: 7,
      level: 1,
      duration: 5000,
      piecesPlaced: 16
    });
  assert.equal(zen.status, 201);
  assert.equal(zen.body.verified, true);
  assert.equal(zen.body.creditsAwarded, 0);
  assert.equal(await getCredits(token), 64);

  const stats = await request(app)
    .get('/api/stats/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(stats.status, 200);
  assert.equal(stats.body.credits, 64);
});

test('A lost Ultra run credits cleared lines with a fractional duration', async () => {
  const { token, user } = await register('credits_ultra_loss');
  assert.equal(user.credits, 0);

  const result = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'ultra_3m',
      result: 'loss',
      score: 100,
      lines: 1,
      level: 1,
      duration: 12345.6,
      piecesPlaced: 20
    });

  assert.equal(result.status, 201);
  assert.equal(result.body.verified, true);
  assert.equal(result.body.creditsAwarded, 1);
  assert.equal(await getCredits(token), 1);
});

test('Rejected results award no credits', async () => {
  const { token, user } = await register('credits_invalid');
  assert.equal(user.credits, 0);

  const invalid = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send({
      mode: 'sprint_40',
      score: 999999,
      lines: 40,
      duration: 2000,
      piecesPlaced: 100
    });

  assert.equal(invalid.status, 201);
  assert.equal(invalid.body.verified, false);
  assert.equal(invalid.body.creditsAwarded, 0);
  assert.equal(await getCredits(token), 0);
});

test('AI, casual online and ranked online matches credit cleared lines once', async () => {
  const playerA = await register('credits_ai_online_a');
  const playerB = await register('credits_ai_online_b');

  const aiMatch = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${playerA.token}`)
    .send({
      opponentName: 'AI Level 5',
      opponentType: 'ai',
      difficulty: 5,
      mode: 'versus_1v1',
      result: 'win',
      playerScore: 3000,
      playerLines: 5,
      piecesPlaced: 12,
      duration: 10000
    });
  assert.equal(aiMatch.status, 201);
  assert.equal(await getCredits(playerA.token), 5);

  const { matchId: casualMatchId } = await createOnlineMatch(app, playerA.token, playerB.token, { ranked: false });
  const casualA = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${playerA.token}`)
    .send({
      matchId: casualMatchId,
      opponentId: playerB.user.id,
      opponentName: playerB.user.display_name,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: false,
      result: 'win',
      playerScore: 5000,
      playerLines: 8,
      piecesPlaced: 20,
      duration: 20000
    });
  assert.equal(casualA.status, 201);
  assert.equal(await getCredits(playerA.token), 13);

  const casualB = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${playerB.token}`)
    .send({
      matchId: casualMatchId,
      opponentId: playerA.user.id,
      opponentName: playerA.user.display_name,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: false,
      result: 'loss',
      playerScore: 2000,
      playerLines: 4,
      piecesPlaced: 14,
      duration: 20000
    });
  assert.equal(casualB.status, 201);
  assert.equal(await getCredits(playerB.token), 4);

  const duplicateB = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${playerB.token}`)
    .send({
      matchId: casualMatchId,
      opponentId: playerA.user.id,
      opponentName: playerA.user.display_name,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: false,
      result: 'loss',
      playerScore: 2000,
      playerLines: 4,
      piecesPlaced: 14,
      duration: 20000
    });
  assert.equal(duplicateB.status, 201);
  assert.equal(await getCredits(playerB.token), 4);

  const { matchId: rankedMatchId } = await createOnlineMatch(app, playerA.token, playerB.token, { ranked: true });
  const rankedA = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${playerA.token}`)
    .send({
      matchId: rankedMatchId,
      opponentId: playerB.user.id,
      opponentName: playerB.user.display_name,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      playerScore: 7000,
      playerLines: 3,
      piecesPlaced: 10,
      duration: 15000
    });
  assert.equal(rankedA.status, 201);
  assert.equal(rankedA.body.pending, true);
  // Credits are only granted once the match is settled at the end.
  assert.equal(await getCredits(playerA.token), 13);

  const rankedB = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${playerB.token}`)
    .send({
      matchId: rankedMatchId,
      opponentId: playerA.user.id,
      opponentName: playerA.user.display_name,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'loss',
      playerScore: 1000,
      playerLines: 2,
      piecesPlaced: 8,
      duration: 15000
    });
  assert.equal(rankedB.status, 201);
  assert.equal(rankedB.body.pending, false);
  assert.equal(await getCredits(playerA.token), 16);
  assert.equal(await getCredits(playerB.token), 6);

  const duplicateRankedB = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${playerB.token}`)
    .send({
      matchId: rankedMatchId,
      opponentId: playerA.user.id,
      opponentName: playerA.user.display_name,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'loss',
      playerScore: 1000,
      playerLines: 2,
      piecesPlaced: 8,
      duration: 15000
    });
  assert.equal(duplicateRankedB.status, 201);
  assert.equal(await getCredits(playerA.token), 16);
  assert.equal(await getCredits(playerB.token), 6);
});

test('Forfeit never awards credits and ignores client opponent values', async () => {
  const winner = await register('credits_forfeit_winner');
  const loser = await register('credits_forfeit_loser');
  const { matchId } = await createOnlineMatch(app, winner.token, loser.token, { ranked: false });

  const forfeit = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${loser.token}`)
    .send({
      matchId,
      opponentId: winner.user.id,
      opponentName: winner.user.display_name,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: false,
      result: 'loss',
      playerScore: 1000,
      playerLines: 6,
      opponentScore: 5000,
      opponentLines: 9,
      piecesPlaced: 14,
      duration: 20000
    });

  assert.equal(forfeit.status, 201);
  assert.equal(await getCredits(loser.token), 0);
  assert.equal(await getCredits(winner.token), 0);

  const repeated = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${loser.token}`)
    .send({
      matchId,
      opponentId: winner.user.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: false,
      result: 'loss',
      duration: 20000
    });

  assert.equal(repeated.status, 201);
  assert.equal(await getCredits(loser.token), 0);
  assert.equal(await getCredits(winner.token), 0);
});
