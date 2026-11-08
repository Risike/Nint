import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';
import { StatsService } from '../src/services/statsService.js';

test('Chess ELO algorithm calculations', () => {
  // Equal rating, win: expected 0.5, delta = round(32 * (1 - 0.5)) = +16
  const eloWin = StatsService.calculateElo({
    playerRating: 1000,
    opponentRating: 1000,
    result: 'win',
    gamesPlayed: 5
  });
  assert.equal(eloWin.oldRating, 1000);
  assert.equal(eloWin.newRating, 1016);
  assert.equal(eloWin.delta, 16);

  // Equal rating, loss: expected 0.5, delta = round(32 * (0 - 0.5)) = -16
  const eloLoss = StatsService.calculateElo({
    playerRating: 1000,
    opponentRating: 1000,
    result: 'loss',
    gamesPlayed: 5
  });
  assert.equal(eloLoss.oldRating, 1000);
  assert.equal(eloLoss.newRating, 984);
  assert.equal(eloLoss.delta, -16);

  // Underdog win: 1000 beats 1200
  const underdogWin = StatsService.calculateElo({
    playerRating: 1000,
    opponentRating: 1200,
    result: 'win',
    gamesPlayed: 5
  });
  assert.ok(underdogWin.delta > 16, `Underdog should gain > 16 ELO, got ${underdogWin.delta}`);
  assert.equal(underdogWin.delta, 24);

  // Favorite win: 1200 beats 1000
  const favoriteWin = StatsService.calculateElo({
    playerRating: 1200,
    opponentRating: 1000,
    result: 'win',
    gamesPlayed: 5
  });
  assert.ok(favoriteWin.delta < 16, `Favorite should gain < 16 ELO, got ${favoriteWin.delta}`);
  assert.equal(favoriteWin.delta, 8);

  // Equal rating, draw: delta 0
  const eloDraw = StatsService.calculateElo({
    playerRating: 1000,
    opponentRating: 1000,
    result: 'draw',
    gamesPlayed: 5
  });
  assert.equal(eloDraw.delta, 0);
  assert.equal(eloDraw.newRating, 1000);
});

test('Online PvP matches update ELO while AI matches do NOT', async () => {
  const emailA = `playerA_${Date.now()}@test.com`;
  const emailB = `playerB_${Date.now()}@test.com`;

  // Register Player A
  const regA = await request(app)
    .post('/api/auth/register')
    .send({ email: emailA, password: 'password123', displayName: 'PlayerA' });
  const tokenA = regA.body.token;
  const userA = regA.body.user;
  assert.equal(userA.rating, 1000);

  // Register Player B
  const regB = await request(app)
    .post('/api/auth/register')
    .send({ email: emailB, password: 'password123', displayName: 'PlayerB' });
  const tokenB = regB.body.token;
  const userB = regB.body.user;
  assert.equal(userB.rating, 1000);

  // 1. Player A plays Online PvP against Player B and wins
  const matchA = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      opponentName: 'PlayerB',
      opponentType: 'human',
      opponentRating: 1000,
      opponentId: userB.id,
      mode: 'versus_online',
      result: 'win',
      playerScore: 5000,
      playerLines: 20,
      duration: 30000
    });

  assert.equal(matchA.status, 201);
  assert.ok(matchA.body.elo);
  assert.equal(matchA.body.elo.delta, 16);
  assert.equal(matchA.body.elo.newRating, 1016);

  // Verify Player A profile now has rating 1016
  const profileA = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(profileA.body.rating, 1016);

  // 2. Player B records match (loss)
  const matchB = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      opponentName: 'PlayerA',
      opponentType: 'human',
      opponentRating: 1000,
      opponentId: userA.id,
      mode: 'versus_online',
      result: 'loss',
      playerScore: 2000,
      playerLines: 10,
      duration: 30000
    });

  assert.equal(matchB.status, 201);
  assert.ok(matchB.body.elo);
  assert.equal(matchB.body.elo.delta, -16);
  assert.equal(matchB.body.elo.newRating, 984);

  // 3. Player A plays against AI and wins
  const aiMatch = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      opponentName: 'AI Level 5',
      opponentType: 'ai',
      difficulty: 5,
      mode: 'versus_1v1',
      result: 'win',
      playerScore: 8000,
      playerLines: 30,
      duration: 40000
    });

  assert.equal(aiMatch.status, 201);
  assert.equal(aiMatch.body.elo, null); // ELO MUST be null for AI

  // Verify Player A rating is STILL 1016 (unchanged by AI match!)
  const profileA2 = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(profileA2.body.rating, 1016);

  // 4. Check ELO Leaderboard
  const lbRes = await request(app).get('/api/leaderboards/elo');
  assert.equal(lbRes.status, 200);
  assert.ok(lbRes.body.entries.length >= 2);
  assert.equal(lbRes.body.entries[0].display_name, 'PlayerA');
  assert.equal(lbRes.body.entries[0].score, 1016);
  assert.equal(lbRes.body.entries[1].display_name, 'PlayerB');
  assert.equal(lbRes.body.entries[1].score, 984);
});
