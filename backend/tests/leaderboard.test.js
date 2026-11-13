import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';
import { registerAndVerify } from './helpers/auth.js';

async function register(label) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const displayName = `${label}${stamp.slice(-6)}`;
  return registerAndVerify(app, {
    email: `${label}_${stamp}@test.com`,
    displayName
  });
}

async function submit(token, payload) {
  const response = await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${token}`)
    .send(payload);
  assert.equal(response.status, 201, JSON.stringify(response.body));
  assert.equal(response.body.verified, true, JSON.stringify(response.body));
}

test('Leaderboards keep only each player best run and rank players, not attempts', async () => {
  const playerA = await register('LeaderA');
  const playerB = await register('LeaderB');

  await submit(playerA.token, { mode: 'blast_fight', score: 100, lines: 10, level: 1, duration: 30000, piecesPlaced: 20 });
  await submit(playerA.token, { mode: 'blast_fight', score: 500, lines: 30, level: 2, duration: 40000, piecesPlaced: 30 });
  await submit(playerA.token, { mode: 'blast_fight', score: 0, lines: 0, level: 1, duration: 5000, piecesPlaced: 3 });
  await submit(playerB.token, { mode: 'blast_fight', score: 900, lines: 50, level: 4, duration: 60000, piecesPlaced: 50 });
  await submit(playerB.token, { mode: 'blast_fight', score: 200, lines: 15, level: 2, duration: 20000, piecesPlaced: 15 });

  await submit(playerA.token, { mode: 'blast_contest', score: 700, lines: 40, level: 1, duration: 30000, piecesPlaced: 20 });
  await submit(playerA.token, { mode: 'blast_contest', score: 300, lines: 25, level: 2, duration: 25000, piecesPlaced: 18 });

  const fightBoard = await request(app).get('/api/leaderboards/blast_fight');
  assert.equal(fightBoard.status, 200);
  assert.equal(fightBoard.body.total, 2);
  assert.equal(fightBoard.body.entries.length, 2);
  assert.deepEqual(
    fightBoard.body.entries.map((entry) => [entry.display_name, entry.score, entry.level]),
    [
      [playerB.user.display_name, 900, 4],
      [playerA.user.display_name, 500, 2]
    ]
  );

  const contestBoard = await request(app).get('/api/leaderboards/blast_contest');
  assert.equal(contestBoard.status, 200);
  assert.equal(contestBoard.body.total, 1);
  assert.equal(contestBoard.body.entries.length, 1);
  assert.equal(contestBoard.body.entries[0].display_name, playerA.user.display_name);
  assert.equal(contestBoard.body.entries[0].score, 700);
  assert.equal(contestBoard.body.entries[0].level, 1);

  const statsA = await request(app)
    .get('/api/stats/me')
    .set('Authorization', `Bearer ${playerA.token}`);
  assert.equal(statsA.status, 200);
  assert.deepEqual(statsA.body.rankings.blast_fight, { rank: 2, total: 2, value: 500 });
  assert.deepEqual(statsA.body.rankings.blast_contest, { rank: 1, total: 1, value: 700 });

  await submit(playerA.token, { mode: 'sprint_40', score: 5000, lines: 40, level: 1, duration: 30000, piecesPlaced: 80 });
  await submit(playerA.token, { mode: 'sprint_40', score: 6000, lines: 40, level: 1, duration: 20000, piecesPlaced: 80 });
  await submit(playerB.token, { mode: 'sprint_40', score: 5500, lines: 40, level: 1, duration: 25000, piecesPlaced: 80 });

  const sprintBoard = await request(app).get('/api/leaderboards/sprint_40');
  assert.equal(sprintBoard.status, 200);
  assert.equal(sprintBoard.body.total, 2);
  assert.equal(sprintBoard.body.entries.length, 2);
  assert.deepEqual(
    sprintBoard.body.entries.map((entry) => [entry.display_name, entry.duration]),
    [
      [playerA.user.display_name, 20000],
      [playerB.user.display_name, 25000]
    ]
  );
});
