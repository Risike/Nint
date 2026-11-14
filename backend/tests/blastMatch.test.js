import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';
import { registerAndVerify } from './helpers/auth.js';
import { createOnlineMatch } from './helpers/online.js';

async function register(label) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  return registerAndVerify(app, {
    email: `${label}_${stamp}@test.com`,
    displayName: `${label.replace(/[^A-Za-z0-9]/g, '')}${stamp.slice(-4)}`
  });
}

test('Blast matches are server-created and record no versus results or credits', async () => {
  const host = await register('blast_host');
  const guest = await register('blast_guest');

  const { matchId } = await createOnlineMatch(app, host.token, guest.token, { mode: 'blast' });
  const info = await request(app)
    .get(`/api/matches/online/${matchId}`)
    .set('Authorization', `Bearer ${host.token}`);
  assert.equal(info.status, 200);
  assert.equal(info.body.mode, 'blast');
  assert.equal(info.body.status, 'active');

  const report = await request(app)
    .post('/api/matches/record')
    .set('Authorization', `Bearer ${host.token}`)
    .send({
      matchId,
      opponentId: guest.user.id,
      opponentName: guest.user.display_name,
      opponentType: 'human',
      mode: 'versus_online',
      ranked: false,
      result: 'win',
      playerScore: 500,
      playerLines: 25,
      piecesPlaced: 60,
      duration: 60000
    });
  assert.equal(report.status, 400);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${host.token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.credits, 0);
  assert.equal(me.body.rating, 1000);
});

test('Blast matches cannot be created as ranked', async () => {
  const host = await register('blast_ranked_host');
  const created = await request(app)
    .post('/api/matches/online')
    .set('Authorization', `Bearer ${host.token}`)
    .send({ ranked: true, mode: 'blast' });
  assert.equal(created.status, 400);
});
