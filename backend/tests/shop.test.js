import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';
import { getDatabase } from '../src/config/database.js';

const PASSWORD = 'password123';

async function register(label) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const res = await request(app)
    .post('/api/auth/register')
    .send({
      email: `${label}_${stamp}@test.com`,
      password: PASSWORD,
      displayName: `${label}${stamp.slice(-4)}`
    });
  assert.equal(res.status, 201);
  return { token: res.body.token, user: res.body.user };
}

async function adminToken() {
  const res = await request(app)
    .post('/api/auth/login')
    .send({
      identifier: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD
    });
  assert.equal(res.status, 200);
  return res.body.token;
}

function auth(req, token) {
  return req.set('Authorization', `Bearer ${token}`);
}

test('Shop catalog, purchases, equipment and admin CRUD work together', async () => {
  const { token, user } = await register('shop_user');
  const db = getDatabase();
  db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(100, user.id);

  const catalog = await auth(request(app).get('/api/shop'), token);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.credits, 100);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'piece_skin').length, 20);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'name_color').length, 20);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'name_decoration').length, 20);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'title').length, 50);
  assert.ok(catalog.body.items.every((item) => item.description === ''));

  const classic = catalog.body.items.find((item) => item.id === 'piece_classic');
  assert.equal(classic.owned, true);
  assert.equal(classic.equipped, true);
  assert.equal(catalog.body.cosmetics.piece_skin, 'classic');

  const buyDefault = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_classic' });
  assert.equal(buyDefault.status, 400);

  const buyNeon = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_neon' });
  assert.equal(buyNeon.status, 200);
  assert.equal(buyNeon.body.credits, 50);

  const duplicate = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_neon' });
  assert.equal(duplicate.status, 409);

  const equipNeon = await auth(request(app).post('/api/shop/equip'), token)
    .send({ itemId: 'piece_neon' });
  assert.equal(equipNeon.status, 200);
  assert.equal(equipNeon.body.cosmetics.piece_skin, 'neon');

  const tooExpensive = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_candy' });
  assert.equal(tooExpensive.status, 400);
  assert.equal(tooExpensive.body.error, 'Not enough credits');

  const title = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'title_line_lord' });
  assert.equal(title.status, 200);
  assert.equal(title.body.credits, 10);

  const equipTitle = await auth(request(app).post('/api/shop/equip'), token)
    .send({ itemId: 'title_line_lord' });
  assert.equal(equipTitle.status, 200);
  assert.equal(equipTitle.body.cosmetics.title, 'Line Lord');

  const after = await auth(request(app).get('/api/shop'), token);
  assert.equal(after.status, 200);
  assert.equal(after.body.credits, 10);
  assert.equal(after.body.items.find((item) => item.id === 'piece_neon').owned, true);
  assert.equal(after.body.items.find((item) => item.id === 'piece_neon').equipped, true);
  assert.equal(after.body.items.find((item) => item.id === 'title_line_lord').equipped, true);

  const me = await auth(request(app).get('/api/auth/me'), token);
  assert.equal(me.status, 200);
  assert.equal(me.body.credits, 10);
  assert.equal(me.body.cosmetics.piece_skin, 'neon');
  assert.equal(me.body.cosmetics.title, 'Line Lord');

  const denied = await auth(request(app).get('/api/admin/shop'), token);
  assert.equal(denied.status, 403);

  const admin = await adminToken();
  const adminList = await auth(request(app).get('/api/admin/shop'), admin);
  assert.equal(adminList.status, 200);
  assert.ok(adminList.body.some((item) => item.id === 'piece_neon'));

  const created = await auth(request(app).post('/api/admin/shop'), admin)
    .send({
      kind: 'name_color',
      name: 'Test Champion',
      description: 'Created by the admin test.',
      value: '#123456',
      price: 15,
      sort_order: 88,
      active: true
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.is_default, 0);
  assert.equal(created.body.description, '');

  const updated = await auth(request(app).put(`/api/admin/shop/${created.body.id}`), admin)
    .send({ name: 'Test Champion II', price: 25 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.name, 'Test Champion II');
  assert.equal(updated.body.price, 25);

  const deleted = await auth(request(app).delete(`/api/admin/shop/${created.body.id}`), admin);
  assert.equal(deleted.status, 200);

  const afterDelete = await auth(request(app).get('/api/admin/shop'), admin);
  assert.equal(afterDelete.body.some((item) => item.id === created.body.id), false);

  const editDefault = await auth(request(app).put('/api/admin/shop/piece_classic'), admin)
    .send({ name: 'Changed' });
  assert.equal(editDefault.status, 400);

  const deleteDefault = await auth(request(app).delete('/api/admin/shop/piece_classic'), admin);
  assert.equal(deleteDefault.status, 400);
});
