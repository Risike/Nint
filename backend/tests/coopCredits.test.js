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

async function getCredits(token) {
  const res = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(res.status, 200);
  return res.body.credits;
}

function report(app, token, matchId, body) {
  return request(app)
    .post(`/api/matches/online/${matchId}/coop-credits`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);
}

test('Co-op boss rounds credit each player once per round', async () => {
  const host = await register('coop_credits_host');
  const guest = await register('coop_credits_guest');
  const { matchId } = await createOnlineMatch(app, host.token, guest.token, { mode: 'coop_boss' });

  const hostRound = await report(app, host.token, matchId, {
    roundKey: '1:1000',
    lines: 12,
    piecesPlaced: 30,
    duration: 30000
  });
  assert.equal(hostRound.status, 201, JSON.stringify(hostRound.body));
  assert.equal(hostRound.body.creditsAwarded, 12);
  assert.equal(hostRound.body.duplicate, false);
  assert.equal(await getCredits(host.token), 12);

  const guestRound = await report(app, guest.token, matchId, {
    roundKey: '1:1000',
    lines: 4,
    piecesPlaced: 10,
    duration: 6000
  });
  assert.equal(guestRound.status, 201, JSON.stringify(guestRound.body));
  assert.equal(guestRound.body.creditsAwarded, 4);
  assert.equal(await getCredits(guest.token), 4);

  // A retried submission for the same round never credits twice.
  const duplicate = await report(app, host.token, matchId, {
    roundKey: '1:1000',
    lines: 12,
    piecesPlaced: 30,
    duration: 30000
  });
  assert.equal(duplicate.status, 201);
  assert.equal(duplicate.body.creditsAwarded, 0);
  assert.equal(duplicate.body.duplicate, true);
  assert.equal(await getCredits(host.token), 12);

  // The next boss round is a new award.
  const nextRound = await report(app, host.token, matchId, {
    roundKey: '2:2000',
    lines: 3,
    piecesPlaced: 8,
    duration: 4000
  });
  assert.equal(nextRound.status, 201);
  assert.equal(nextRound.body.creditsAwarded, 3);
  assert.equal(await getCredits(host.token), 15);
});

test('Co-op credits reject outsiders, non co-op matches and implausible reports', async () => {
  const host = await register('coop_credits_rules_host');
  const guest = await register('coop_credits_rules_guest');
  const outsider = await register('coop_credits_rules_outsider');
  const { matchId } = await createOnlineMatch(app, host.token, guest.token, { mode: 'coop_boss' });

  const foreign = await report(app, outsider.token, matchId, {
    roundKey: '1:1000',
    lines: 5,
    piecesPlaced: 12,
    duration: 10000
  });
  assert.equal(foreign.status, 403);
  assert.equal(await getCredits(outsider.token), 0);

  const versus = await createOnlineMatch(app, host.token, guest.token, { ranked: false });
  const versusReport = await report(app, host.token, versus.matchId, {
    roundKey: '1:1000',
    lines: 5,
    piecesPlaced: 12,
    duration: 10000
  });
  assert.equal(versusReport.status, 400);

  const implausible = await report(app, host.token, matchId, {
    roundKey: '1:1000',
    lines: 40,
    piecesPlaced: 5,
    duration: 10000
  });
  assert.equal(implausible.status, 400);
  assert.equal(await getCredits(host.token), 0);

  const tooFast = await report(app, host.token, matchId, {
    roundKey: '1:1000',
    lines: 4,
    piecesPlaced: 40,
    duration: 1000
  });
  assert.equal(tooFast.status, 400);

  const missingRound = await report(app, host.token, matchId, {
    lines: 4,
    piecesPlaced: 10,
    duration: 10000
  });
  assert.equal(missingRound.status, 400);

  const unjoined = await createOnlineMatch(app, host.token, null, { mode: 'coop_boss' });
  const notStarted = await report(app, host.token, unjoined.matchId, {
    roundKey: '1:1000',
    lines: 4,
    piecesPlaced: 10,
    duration: 10000
  });
  assert.equal(notStarted.status, 409);
});
