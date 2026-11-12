import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';
import { StatsService } from '../src/services/statsService.js';
import { registerAndVerify } from './helpers/auth.js';
import { createOnlineMatch } from './helpers/online.js';

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

test('Online PvP ELO requires both reports; AI matches never change rating', async () => {
  const stamp = Date.now();
  const emailA = `playerA_${stamp}@test.com`;
  const emailB = `playerB_${stamp}@test.com`;

  // Register Player A
  const { token: tokenA, user: userA } = await registerAndVerify(app, {
    email: emailA,
    displayName: 'PlayerA'
  });
  assert.equal(userA.rating, 1000);

  // Register Player B
  const { token: tokenB, user: userB } = await registerAndVerify(app, {
    email: emailB,
    displayName: 'PlayerB'
  });
  assert.equal(userB.rating, 1000);

  const { matchId } = await createOnlineMatch(app, tokenA, tokenB, { ranked: true });

  // 1. Player A reports a win: it must stay pending, with no rating change yet
  const matchA = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      matchId,
      opponentId: userB.id,
      opponentName: 'PlayerB',
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      playerScore: 5000,
      playerLines: 20,
      piecesPlaced: 40,
      duration: 30000
    });

  assert.equal(matchA.status, 201);
  assert.equal(matchA.body.elo, null);
  assert.equal(matchA.body.pending, true);
  assert.equal(matchA.body.ranked, true);

  const profileA1 = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(profileA1.body.rating, 1000);

  // 2. Player B reports the complementary loss: ELO is applied to both players
  const matchB = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      matchId,
      opponentId: userA.id,
      opponentName: 'PlayerA',
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'loss',
      playerScore: 2000,
      playerLines: 10,
      piecesPlaced: 25,
      duration: 30000
    });

  assert.equal(matchB.status, 201);
  assert.equal(matchB.body.ranked, true);
  assert.ok(matchB.body.elo);
  assert.equal(matchB.body.elo.delta, -16);
  assert.equal(matchB.body.elo.newRating, 984);

  const profileA2 = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(profileA2.body.rating, 1016);

  const statsA = await request(app)
    .get('/api/stats/me')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(statsA.body.stats.wins, 1);
  assert.equal(statsA.body.recentMatches[0].rating_change, 16);

  // 3. The same report cannot be recorded twice for the same match
  const duplicate = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      matchId,
      opponentId: userA.id,
      opponentName: 'PlayerA',
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'loss',
      playerScore: 2000,
      playerLines: 10,
      piecesPlaced: 25,
      duration: 30000
    });
  assert.equal(duplicate.status, 409);

  // 4. Player A plays against the AI and wins: no ELO change
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
  assert.equal(aiMatch.body.elo, null);

  const profileA3 = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${tokenA}`);
  assert.equal(profileA3.body.rating, 1016);

  // 5. Online matches without a server-issued match are rejected
  const missingId = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      opponentId: userB.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      duration: 10000
    });
  assert.equal(missingId.status, 400);

  const unknownMatch = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      matchId: `invented_${stamp}`,
      opponentType: 'human',
      ranked: true,
      result: 'win',
      duration: 10000
    });
  assert.equal(unknownMatch.status, 404);

  // 6. Conflicting reports are rejected instead of inflating ratings
  const { matchId: conflictMatchId } = await createOnlineMatch(app, tokenA, tokenB, { ranked: true });
  await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenA}`)
    .send({
      matchId: conflictMatchId,
      opponentId: userB.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      duration: 20000
    });

  const conflict = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenB}`)
    .send({
      matchId: conflictMatchId,
      opponentId: userA.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      duration: 20000
    });
  assert.equal(conflict.status, 409);

  // 7. Check ELO leaderboard
  const lbRes = await request(app).get('/api/leaderboards/elo');
  assert.equal(lbRes.status, 200);
  assert.ok(lbRes.body.entries.length >= 2);
  assert.equal(lbRes.body.entries[0].display_name, 'PlayerA');
  assert.equal(lbRes.body.entries[0].score, 1016);
  assert.equal(lbRes.body.entries[1].display_name, 'PlayerB');
  assert.equal(lbRes.body.entries[1].score, 984);
});

test('Forfeit penalizes only the abandoning player and is idempotent', async () => {
  const stamp = Date.now();

  const { token: winnerToken, user: winner } = await registerAndVerify(app, {
    email: `forfeit_winner_${stamp}@test.com`,
    displayName: 'ForfeitWinner'
  });

  const { token: loserToken, user: loser } = await registerAndVerify(app, {
    email: `forfeit_loser_${stamp}@test.com`,
    displayName: 'ForfeitLoser'
  });

  const { matchId } = await createOnlineMatch(app, winnerToken, loserToken, { ranked: true });

  // Simulate the leaver's unload request arriving first.
  const loserForfeit = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${loserToken}`)
    .send({
      matchId,
      opponentId: winner.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'loss',
      playerScore: 2000,
      playerLines: 10,
      piecesPlaced: 25,
      duration: 30000
    });

  assert.equal(loserForfeit.status, 201);
  assert.equal(loserForfeit.body.pending, false);
  assert.equal(loserForfeit.body.ranked, true);
  assert.equal(loserForfeit.body.elo.delta, -16);
  assert.equal(loserForfeit.body.elo.newRating, 984);

  const winnerProfile = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${winnerToken}`);
  const loserProfile = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${loserToken}`);
  assert.equal(winnerProfile.body.rating, 1000);
  assert.equal(loserProfile.body.rating, 984);

  const winnerStats = await request(app)
    .get('/api/stats/me')
    .set('Authorization', `Bearer ${winnerToken}`);
  const loserStats = await request(app)
    .get('/api/stats/me')
    .set('Authorization', `Bearer ${loserToken}`);
  assert.equal(winnerStats.body.stats.wins, 1);
  assert.equal(loserStats.body.stats.losses, 1);
  assert.equal(winnerStats.body.stats.games_played, 1);
  assert.equal(loserStats.body.stats.games_played, 1);
  assert.equal(winnerStats.body.recentMatches[0].rating_change, 0);

  // Repeating the departing player's request must not apply a second loss.
  const repeat = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${loserToken}`)
    .send({
      matchId,
      opponentId: winner.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'loss',
      duration: 30000
    });
  assert.equal(repeat.status, 201);
  assert.equal(repeat.body.elo.newRating, 984);

  // A winner cannot claim a forfeit and cannot duplicate the normal report.
  const winnerClaim = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${winnerToken}`)
    .send({
      matchId,
      opponentId: loser.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      duration: 30000
    });
  assert.equal(winnerClaim.status, 400);

  const duplicateWin = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${winnerToken}`)
    .send({
      matchId,
      opponentId: loser.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      duration: 30000
    });
  assert.equal(duplicateWin.status, 409);

  const loserProfileAfterRepeat = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${loserToken}`);
  assert.equal(loserProfileAfterRepeat.body.rating, 984);
});

test('A pending winner report still awards no ELO after a forfeit', async () => {
  const stamp = Date.now();

  const { token: winnerToken, user: winner } = await registerAndVerify(app, {
    email: `pending_winner_${stamp}@test.com`,
    displayName: 'PendingWinner'
  });

  const { token: loserToken, user: loser } = await registerAndVerify(app, {
    email: `pending_loser_${stamp}@test.com`,
    displayName: 'PendingLoser'
  });

  const { matchId } = await createOnlineMatch(app, winnerToken, loserToken, { ranked: true });

  const pendingWin = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${winnerToken}`)
    .send({
      matchId,
      opponentId: loser.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      duration: 30000
    });
  assert.equal(pendingWin.status, 201);
  assert.equal(pendingWin.body.pending, true);

  const forfeit = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${loserToken}`)
    .send({
      matchId,
      opponentId: winner.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'loss',
      duration: 30000
    });
  assert.equal(forfeit.status, 201);
  assert.equal(forfeit.body.elo.delta, -16);
  assert.equal(forfeit.body.elo.newRating, 984);

  const winnerProfile = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${winnerToken}`);
  const loserProfile = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${loserToken}`);
  assert.equal(winnerProfile.body.rating, 1000);
  assert.equal(loserProfile.body.rating, 984);
});

test('Casual forfeit records a result but changes no rating', async () => {
  const stamp = Date.now();

  const { token: winnerToken, user: winner } = await registerAndVerify(app, {
    email: `casual_forfeit_winner_${stamp}@test.com`,
    displayName: 'CasualForfeitWinner'
  });

  const { token: loserToken, user: loser } = await registerAndVerify(app, {
    email: `casual_forfeit_loser_${stamp}@test.com`,
    displayName: 'CasualForfeitLoser'
  });

  const { matchId } = await createOnlineMatch(app, winnerToken, loserToken, { ranked: false });

  const forfeit = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${loserToken}`)
    .send({
      matchId,
      opponentId: winner.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: false,
      result: 'loss',
      duration: 30000
    });

  assert.equal(forfeit.status, 201);
  assert.equal(forfeit.body.elo, null);
  assert.equal(forfeit.body.pending, false);
  assert.equal(forfeit.body.ranked, false);

  const winnerProfile = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${winnerToken}`);
  const loserProfile = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${loserToken}`);
  assert.equal(winnerProfile.body.rating, 1000);
  assert.equal(loserProfile.body.rating, 1000);
});

test('Forfeit endpoint rejects forged, unauthenticated and invalid claims', async () => {
  const stamp = Date.now();

  const { token: attackerToken, user: attacker } = await registerAndVerify(app, {
    email: `forfeit_attacker_${stamp}@test.com`,
    displayName: 'ForfeitAttacker'
  });

  const { token: victimToken, user: victim } = await registerAndVerify(app, {
    email: `forfeit_victim_${stamp}@test.com`,
    displayName: 'ForfeitVictim'
  });

  const base = {
    matchId: `match_forged_${stamp}`,
    opponentId: victim.id,
    opponentType: 'human',
    mode: 'versus_online',
    ranked: true,
    duration: 30000
  };

  const unauthenticated = await request(app)
    .post('/api/matches/forfeit')
    .send({ ...base, result: 'loss' });
  assert.equal(unauthenticated.status, 401);

  const forgedWin = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${attackerToken}`)
    .send({ ...base, result: 'win' });
  assert.equal(forgedWin.status, 400);

  const selfForfeit = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${attackerToken}`)
    .send({ ...base, opponentId: attacker.id, result: 'loss' });
  assert.equal(selfForfeit.status, 404);

  const invalidMatch = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${attackerToken}`)
    .send({ ...base, matchId: 'x', result: 'loss' });
  assert.equal(invalidMatch.status, 404);

  const invalidResult = await request(app)
    .post('/api/matches/forfeit')
    .set('Authorization', `Bearer ${attackerToken}`)
    .send({ ...base, result: 'draw' });
  assert.equal(invalidResult.status, 400);

  const victimProfile = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${victimToken}`);
  assert.equal(victimProfile.body.rating, 1000);

  // A player may self-report a loss, but this must never change the opponent's rating.
  // Exercise the unload fallback: no Authorization header, JWT in the body.
  const { matchId: selfLossMatchId } = await createOnlineMatch(app, attackerToken, victimToken, { ranked: true });
  const selfLoss = await request(app)
    .post('/api/matches/forfeit')
    .send({ ...base, matchId: selfLossMatchId, result: 'loss', token: attackerToken });
  assert.equal(selfLoss.status, 201);
  assert.equal(selfLoss.body.elo.delta, -16);

  const invalidBodyToken = await request(app)
    .post('/api/matches/forfeit')
    .send({ ...base, matchId: `match_bad_token_${stamp}`, result: 'loss', token: 'not-a-jwt' });
  assert.equal(invalidBodyToken.status, 403);

  const victimAfterSelfLoss = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${victimToken}`);
  assert.equal(victimAfterSelfLoss.body.rating, 1000);
});

test('Casual online matches are recorded immediately and never change ELO', async () => {
  const stamp = Date.now();
  const emailC = `playerC_${stamp}@test.com`;
  const emailD = `playerD_${stamp}@test.com`;

  const { token: tokenC, user: userC } = await registerAndVerify(app, {
    email: emailC,
    displayName: 'PlayerC'
  });

  const { token: tokenD, user: userD } = await registerAndVerify(app, {
    email: emailD,
    displayName: 'PlayerD'
  });

  const { matchId } = await createOnlineMatch(app, tokenC, tokenD, { ranked: false });

  const casualWin = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenC}`)
    .send({
      matchId,
      opponentId: userD.id,
      opponentType: 'human',
      mode: 'versus_online',
      result: 'win',
      duration: 30000
    });

  assert.equal(casualWin.status, 201);
  assert.equal(casualWin.body.elo, null);
  assert.equal(casualWin.body.pending, false);
  assert.equal(casualWin.body.ranked, false);

  const casualLoss = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenD}`)
    .send({
      matchId,
      opponentId: userC.id,
      opponentType: 'human',
      mode: 'versus_online',
      result: 'loss',
      duration: 30000
    });

  assert.equal(casualLoss.status, 201);
  assert.equal(casualLoss.body.elo, null);
  assert.equal(casualLoss.body.ranked, false);

  const profileC = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${tokenC}`);
  const profileD = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${tokenD}`);
  assert.equal(profileC.body.rating, 1000);
  assert.equal(profileD.body.rating, 1000);

  const casualOnlyLeaderboard = await request(app).get('/api/leaderboards/elo');
  assert.ok(!casualOnlyLeaderboard.body.entries.some((entry) =>
    entry.display_name === 'PlayerC' || entry.display_name === 'PlayerD'
  ));

  // The client cannot upgrade a casual match to ranked: the server owns the flag.
  const { matchId: mismatchId } = await createOnlineMatch(app, tokenC, tokenD, { ranked: false });
  const rankedReport = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenC}`)
    .send({
      matchId: mismatchId,
      opponentId: userD.id,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: true,
      result: 'win',
      duration: 20000
    });
  assert.equal(rankedReport.status, 201);
  assert.equal(rankedReport.body.ranked, false);
  assert.equal(rankedReport.body.pending, false);

  const casualMismatch = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${tokenD}`)
    .send({
      matchId: mismatchId,
      opponentId: userC.id,
      opponentType: 'human',
      mode: 'versus_online',
      result: 'loss',
      duration: 20000
    });
  assert.equal(casualMismatch.status, 201);
  assert.equal(casualMismatch.body.ranked, false);
});
