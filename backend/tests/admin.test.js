import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';

test('Admin auto-creation and full admin capabilities', async () => {
  // 1. Admin login with default credentials
  const adminLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@nint.nint', password: 'admin123' });

  assert.equal(adminLogin.status, 200);
  assert.ok(adminLogin.body.token);
  assert.equal(adminLogin.body.user.is_admin, true);

  const adminToken = adminLogin.body.token;
  const adminId = adminLogin.body.user.id;

  // 2. Regular user registration
  const regularEmail = `player_${Date.now()}@example.com`;
  const regRes = await request(app)
    .post('/api/auth/register')
    .send({ email: regularEmail, password: 'PlayerPass123!', displayName: 'NormalPlayer' });

  assert.equal(regRes.status, 201);
  const regularToken = regRes.body.token;
  const regularUserId = regRes.body.user.id;

  // 3. Regular user is blocked from admin routes (403)
  const forbiddenRes = await request(app)
    .get('/api/admin/users')
    .set('Authorization', `Bearer ${regularToken}`);
  assert.equal(forbiddenRes.status, 403);

  // 4. News route: public read
  const initialNews = await request(app).get('/api/admin/news');
  assert.equal(initialNews.status, 200);
  assert.ok('message' in initialNews.body);

  // 5. Admin updates news
  const updateNewsRes = await request(app)
    .put('/api/admin/news')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ message: 'Nouveau tournoi ce week-end !' });
  assert.equal(updateNewsRes.status, 200);
  assert.equal(updateNewsRes.body.success, true);

  const updatedNews = await request(app).get('/api/admin/news');
  assert.equal(updatedNews.body.message, 'Nouveau tournoi ce week-end !');

  // 6. Regular user submits a score to the leaderboard
  await request(app)
    .post('/api/results')
    .set('Authorization', `Bearer ${regularToken}`)
    .send({
      mode: 'marathon_150',
      score: 50000,
      lines: 30,
      level: 4,
      duration: 60000,
      piecesPlaced: 50,
      pps: 0.8,
      apm: 20
    });

  const lbBefore = await request(app).get('/api/leaderboards/marathon_150');
  assert.ok(lbBefore.body.entries.length >= 1);

  // 7. Admin clears leaderboards
  const clearLbRes = await request(app)
    .delete('/api/admin/leaderboards')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(clearLbRes.status, 200);
  assert.equal(clearLbRes.body.success, true);

  const lbAfter = await request(app).get('/api/leaderboards/marathon_150');
  assert.equal(lbAfter.body.entries.length, 0);

  // 8. Search users
  const searchRes = await request(app)
    .get(`/api/admin/users?q=${encodeURIComponent('NormalPlayer')}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(searchRes.status, 200);
  assert.ok(searchRes.body.length >= 1);
  assert.equal(searchRes.body[0].email, regularEmail);

  // 9. Admin clears player stats
  const clearStatsRes = await request(app)
    .delete(`/api/admin/users/${regularUserId}/stats`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(clearStatsRes.status, 200);
  assert.equal(clearStatsRes.body.success, true);

  // 10. Admin cannot delete self
  const deleteSelfRes = await request(app)
    .delete(`/api/admin/users/${adminId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(deleteSelfRes.status, 400);

  // 11. Admin deletes the regular user
  const deleteUserRes = await request(app)
    .delete(`/api/admin/users/${regularUserId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.equal(deleteUserRes.status, 200);
  assert.equal(deleteUserRes.body.success, true);

  // Verify deleted user cannot login
  const deletedLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: regularEmail, password: 'PlayerPass123!' });
  assert.equal(deletedLogin.status, 401);
});
