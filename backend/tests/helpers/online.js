import assert from 'node:assert/strict';
import request from 'supertest';

export async function createOnlineMatch(app, hostToken, guestToken, { ranked = false, mode = 'versus' } = {}) {
  const created = await request(app)
    .post('/api/matches/online')
    .set('Authorization', `Bearer ${hostToken}`)
    .send({ ranked, mode });

  assert.equal(created.status, 201, JSON.stringify(created.body));

  if (guestToken) {
    const joined = await request(app)
      .post(`/api/matches/online/${created.body.matchId}/join`)
      .set('Authorization', `Bearer ${guestToken}`)
      .send({});

    assert.equal(joined.status, 200, JSON.stringify(joined.body));
    assert.equal(joined.body.ranked, ranked);
  }

  return {
    matchId: created.body.matchId,
    seed: created.body.seed,
    ranked: created.body.ranked
  };
}
