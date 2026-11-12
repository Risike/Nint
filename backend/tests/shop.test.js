import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import app from '../src/server.js';
import { getDatabase } from '../src/config/database.js';
import { registerAndVerify } from './helpers/auth.js';

async function register(label) {
  const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const displayName = `${label.replace(/[^A-Za-z0-9]/g, '')}${stamp.slice(-4)}`;
  return registerAndVerify(app, {
    email: `${label}_${stamp}@test.com`,
    displayName
  });
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
  db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(2500, user.id);

  const catalog = await auth(request(app).get('/api/shop'), token);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.credits, 2500);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'piece_skin').length, 40);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'name_color').length, 50);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'name_decoration').length, 50);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'profile_icon').length, 56);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'theme').length, 40);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'theme' && item.value.startsWith('dark-')).length, 20);
  assert.equal(catalog.body.items.filter((item) => item.kind === 'theme' && item.value.startsWith('light-')).length, 20);
  assert.ok(catalog.body.items.some((item) => item.value === 'flag_pirate'));
  assert.ok(catalog.body.items.some((item) => item.id === 'color_mint'));
  assert.ok(catalog.body.items.some((item) => item.id === 'decor_quotes'));
  const colorItems = catalog.body.items.filter((item) => item.kind === 'name_color');
  const solidColors = colorItems.filter((item) => !item.value.startsWith('gradient:'));
  const gradientColors = colorItems.filter((item) => item.value.startsWith('gradient:'));
  assert.equal(solidColors.length, 20);
  assert.equal(gradientColors.length, 30);
  assert.equal(new Set(colorItems.map((item) => item.value)).size, 50);
  const rainbow = catalog.body.items.find((item) => item.id === 'color_grad_rainbow');
  assert.equal(rainbow.name, 'Rainbow');
  assert.equal(rainbow.price, 400);
  assert.match(rainbow.value, /^gradient:90:#ff0040,/);
  const goldFrame = catalog.body.items.find((item) => item.id === 'decor_gradient_fill');
  assert.equal(goldFrame.name, 'Gold Frame');
  assert.equal(goldFrame.value, 'gold_frame');
  assert.equal(catalog.body.items.find((item) => item.id === 'color_mint').value, '#6ee7b7');
  assert.equal(catalog.body.items.find((item) => item.id === 'color_cyan').name, 'Cyan');
  assert.equal(catalog.body.items.find((item) => item.id === 'theme_dark_01').value, 'dark-01');
  assert.equal(catalog.body.items.find((item) => item.id === 'theme_dark_01').price, 0);
  assert.equal(catalog.body.items.find((item) => item.id === 'theme_dark_01').owned, true);
  assert.equal(catalog.body.items.find((item) => item.id === 'theme_dark_01').equipped, true);
  assert.ok(catalog.body.items.filter((item) => item.kind === 'theme' && !item.is_default).every((item) => item.price === 1200));
  assert.equal(catalog.body.items.filter((item) => item.kind === 'title').length, 50);
  assert.ok(catalog.body.items.every((item) => item.description === ''));
  assert.ok(catalog.body.items.filter((item) => item.kind === 'piece_skin').every((item) => item.price === 1000));
  assert.ok(solidColors.filter((item) => !item.is_default).every((item) => item.price === 400));
  assert.ok(gradientColors.every((item) => item.price === 400));
  assert.ok(catalog.body.items.filter((item) => item.kind === 'name_decoration').every((item) => item.price === 800));
  assert.ok(catalog.body.items.filter((item) => item.kind === 'profile_icon').every((item) => item.price === 200));
  assert.ok(catalog.body.items.filter((item) => item.kind === 'title').every((item) => item.price === 500));

  const classic = catalog.body.items.find((item) => item.id === 'piece_classic');
  assert.equal(classic.owned, true);
  assert.equal(classic.equipped, true);
  assert.equal(catalog.body.cosmetics.piece_skin, 'classic');

  const defaultIcon = catalog.body.items.find((item) => item.id === 'icon_user');
  assert.equal(defaultIcon.owned, true);
  assert.equal(defaultIcon.equipped, true);
  assert.equal(catalog.body.cosmetics.profile_icon, 'user');

  const buyDefault = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_classic' });
  assert.equal(buyDefault.status, 400);

  const buyNeon = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_neon' });
  assert.equal(buyNeon.status, 200);
  assert.equal(buyNeon.body.credits, 1500);

  const duplicate = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_neon' });
  assert.equal(duplicate.status, 409);

  const equipNeon = await auth(request(app).post('/api/shop/equip'), token)
    .send({ itemId: 'piece_neon' });
  assert.equal(equipNeon.status, 200);
  assert.equal(equipNeon.body.cosmetics.piece_skin, 'neon');

  const buyCandy = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_candy' });
  assert.equal(buyCandy.status, 200);
  assert.equal(buyCandy.body.credits, 500);

  const tooExpensive = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'piece_glass' });
  assert.equal(tooExpensive.status, 400);
  assert.equal(tooExpensive.body.error, 'Not enough credits');

  const title = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'title_line_lord' });
  assert.equal(title.status, 200);
  assert.equal(title.body.credits, 0);

  const equipTitle = await auth(request(app).post('/api/shop/equip'), token)
    .send({ itemId: 'title_line_lord' });
  assert.equal(equipTitle.status, 200);
  assert.equal(equipTitle.body.cosmetics.title, 'Line Lord');

  db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(1200, user.id);
  const buyTheme = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'theme_light_01' });
  assert.equal(buyTheme.status, 200);
  assert.equal(buyTheme.body.credits, 0);

  const equipTheme = await auth(request(app).post('/api/shop/equip'), token)
    .send({ itemId: 'theme_light_01' });
  assert.equal(equipTheme.status, 200);
  assert.equal(equipTheme.body.cosmetics.theme, 'light-01');

  const themeSettings = await auth(request(app).get('/api/settings'), token);
  assert.equal(themeSettings.status, 200);
  assert.equal(themeSettings.body.theme, 'light-01');

  const after = await auth(request(app).get('/api/shop'), token);
  assert.equal(after.status, 200);
  assert.equal(after.body.credits, 0);
  assert.equal(after.body.items.find((item) => item.id === 'piece_neon').owned, true);
  assert.equal(after.body.items.find((item) => item.id === 'piece_neon').equipped, true);
  assert.equal(after.body.items.find((item) => item.id === 'title_line_lord').equipped, true);
  assert.equal(after.body.items.find((item) => item.id === 'theme_light_01').equipped, true);

  const me = await auth(request(app).get('/api/auth/me'), token);
  assert.equal(me.status, 200);
  assert.equal(me.body.credits, 0);
  assert.equal(me.body.cosmetics.piece_skin, 'neon');
  assert.equal(me.body.cosmetics.title, 'Line Lord');
  assert.equal(me.body.cosmetics.theme, 'light-01');

  const denied = await auth(request(app).get('/api/admin/shop'), token);
  assert.equal(denied.status, 403);

  const admin = await adminToken();
  const adminList = await auth(request(app).get('/api/admin/shop'), admin);
  assert.equal(adminList.status, 200);
  assert.ok(adminList.body.some((item) => item.id === 'piece_neon'));
  assert.ok(adminList.body.every((item) =>
    item.name_fr && item.name_de && item.name_es && item.name_it
  ));
  const nintLegend = adminList.body.find((item) => item.id === 'title_nint_legend');
  assert.equal(nintLegend.name_fr, 'Légende Nint');
  assert.equal(nintLegend.name_de, 'Nint-Legende');
  assert.equal(nintLegend.name_es, 'Leyenda Nint');
  assert.equal(nintLegend.name_it, 'Leggenda Nint');
  const rainbowAdmin = adminList.body.find((item) => item.id === 'color_grad_rainbow');
  assert.equal(rainbowAdmin.name_fr, 'Arc-en-ciel');
  assert.equal(rainbowAdmin.name_de, 'Regenbogen');
  assert.equal(rainbowAdmin.name_es, 'Arcoíris');
  assert.equal(rainbowAdmin.name_it, 'Arcobaleno');
  const midnightTheme = adminList.body.find((item) => item.id === 'theme_dark_01');
  assert.equal(midnightTheme.name, 'Dark — Midnight');
  assert.equal(midnightTheme.name_fr, 'Sombre — Minuit');
  assert.equal(midnightTheme.name_de, 'Dunkel — Mitternacht');
  assert.equal(midnightTheme.name_es, 'Oscuro — Medianoche');
  assert.equal(midnightTheme.name_it, 'Scuro — Mezzanotte');
  const roundPearl = adminList.body.find((item) => item.id === 'piece_round_pearl');
  assert.equal(roundPearl.name, 'Pearl');
  assert.equal(roundPearl.name_fr, 'Perle');
  assert.equal(roundPearl.name_de, 'Perle');
  assert.equal(roundPearl.name_es, 'Perla');
  assert.equal(roundPearl.name_it, 'Perla');

  const created = await auth(request(app).post('/api/admin/shop'), admin)
    .send({
      kind: 'name_color',
      name: 'Test Champion',
      name_fr: 'Champion de test',
      name_de: 'Test-Champion',
      name_es: 'Campeón de prueba',
      name_it: 'Campione di prova',
      description: 'Created by the admin test.',
      value: '#123456',
      price: 15,
      sort_order: 88,
      active: true
    });
  assert.equal(created.status, 201);
  assert.equal(created.body.is_default, 0);
  assert.equal(created.body.description, '');
  assert.equal(created.body.name_fr, 'Champion de test');
  assert.equal(created.body.name_de, 'Test-Champion');
  assert.equal(created.body.name_es, 'Campeón de prueba');
  assert.equal(created.body.name_it, 'Campione di prova');

  const catalogAfterCreate = await auth(request(app).get('/api/shop'), token);
  const customCatalogItem = catalogAfterCreate.body.items.find((item) => item.id === created.body.id);
  assert.equal(customCatalogItem.name_fr, 'Champion de test');
  assert.equal(customCatalogItem.name, 'Test Champion');

  const updated = await auth(request(app).put(`/api/admin/shop/${created.body.id}`), admin)
    .send({ name: 'Test Champion II', name_fr: 'Champion II', name_de: '', value: 'gradient:45:#FF0000,#00FF00', price: 25 });
  assert.equal(updated.status, 200);
  assert.equal(updated.body.name, 'Test Champion II');
  assert.equal(updated.body.name_fr, 'Champion II');
  assert.equal(updated.body.name_de, '');
  assert.equal(updated.body.name_es, 'Campeón de prueba');
  assert.equal(updated.body.value, 'gradient:45:#ff0000,#00ff00');
  assert.equal(updated.body.price, 25);

  const deleted = await auth(request(app).delete(`/api/admin/shop/${created.body.id}`), admin);
  assert.equal(deleted.status, 200);

  const afterDelete = await auth(request(app).get('/api/admin/shop'), admin);
  assert.equal(afterDelete.body.some((item) => item.id === created.body.id), false);

  const createSkin = await auth(request(app).post('/api/admin/shop'), admin)
    .send({ kind: 'piece_skin', name: 'New Skin', value: 'round_classic', price: 10 });
  assert.equal(createSkin.status, 400);
  assert.equal(createSkin.body.error, 'New items cannot be added to this category');

  const publicDecorations = await request(app).get('/api/shop/decorations');
  assert.equal(publicDecorations.status, 200);
  assert.equal(publicDecorations.body.length, 50);
  assert.ok(publicDecorations.body.some((item) => item.value === 'ribbon'));
  assert.ok(publicDecorations.body.some((item) => item.value === 'orbit'));
  assert.equal(publicDecorations.body.some((item) => item.value === 'neon_glow'), false);
  assert.equal(publicDecorations.body.some((item) => item.value === 'strike'), false);

  const createDecoration = await auth(request(app).post('/api/admin/shop'), admin)
    .send({
      kind: 'name_decoration',
      name: 'Custom Spark',
      value: 'custom_spark',
      html: '<span style="text-shadow: 0 0 8px {color}">{name}</span>',
      price: 0
    });
  assert.equal(createDecoration.status, 201);
  assert.equal(createDecoration.body.value, 'custom_spark');
  assert.equal(createDecoration.body.html, '<span style="text-shadow: 0 0 8px {color}">{name}</span>');

  const duplicateDecoration = await auth(request(app).post('/api/admin/shop'), admin)
    .send({ kind: 'name_decoration', name: 'Duplicate Spark', value: 'custom_spark' });
  assert.equal(duplicateDecoration.status, 409);
  assert.equal(duplicateDecoration.body.error, 'This name decoration value already exists');

  const invalidDecorationHtml = await auth(request(app).post('/api/admin/shop'), admin)
    .send({ kind: 'name_decoration', name: 'Bad Decoration', value: 'custom_bad', html: '<span>No name</span>' });
  assert.equal(invalidDecorationHtml.status, 400);
  assert.equal(invalidDecorationHtml.body.error, 'Name decoration HTML must include {name}');

  const adminCatalog = await auth(request(app).get('/api/admin/shop'), admin);
  const defaultDecoration = adminCatalog.body.find((item) => item.id === 'decor_none');
  const updateDefaultDecoration = await auth(request(app).put(`/api/admin/shop/${defaultDecoration.id}`), admin)
    .send({ html: '<span>{name}</span>' });
  assert.equal(updateDefaultDecoration.status, 200);
  assert.equal(updateDefaultDecoration.body.html, '<span>{name}</span>');

  const updateDecoration = await auth(request(app).put(`/api/admin/shop/${createDecoration.body.id}`), admin)
    .send({ html: '<span style="opacity: .8">{name}</span>' });
  assert.equal(updateDecoration.status, 200);
  assert.equal(updateDecoration.body.html, '<span style="opacity: .8">{name}</span>');

  const decorationCatalog = await request(app).get('/api/shop/decorations');
  const customDecoration = decorationCatalog.body.find((item) => item.value === 'custom_spark');
  assert.equal(customDecoration.labels.en, 'Custom Spark');
  assert.equal(customDecoration.html, '<span style="opacity: .8">{name}</span>');

  const buyDecoration = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: createDecoration.body.id });
  assert.equal(buyDecoration.status, 200);
  const equipDecoration = await auth(request(app).post('/api/shop/equip'), token)
    .send({ itemId: createDecoration.body.id });
  assert.equal(equipDecoration.status, 200);
  assert.equal(equipDecoration.body.cosmetics.name_decoration, 'custom_spark');
  const decoratedProfile = await auth(request(app).get('/api/auth/me'), token);
  assert.equal(decoratedProfile.body.cosmetics.name_decoration, 'custom_spark');

  const deleteDecoration = await auth(request(app).delete(`/api/admin/shop/${createDecoration.body.id}`), admin);
  assert.equal(deleteDecoration.status, 200);

  const publicThemes = await request(app).get('/api/shop/themes');
  assert.equal(publicThemes.status, 200);
  assert.equal(publicThemes.body.length, 40);
  assert.equal(publicThemes.body.find((theme) => theme.value === 'dark-01').preview.bgPrimary, '#0b0d19');

  const createTheme = await auth(request(app).post('/api/admin/shop'), admin)
    .send({
      kind: 'theme',
      name: 'Custom Theme',
      name_fr: 'Thème personnalisé',
      value: 'custom-test',
      mode: 'light',
      palette: { bgPrimary: '#101010', accentCyan: '#ff00aa' },
      price: 10
    });
  assert.equal(createTheme.status, 201);
  const createdThemePalette = JSON.parse(createTheme.body.palette);
  assert.equal(createdThemePalette.bgPrimary, '#101010');
  assert.equal(createdThemePalette.accentCyan, '#ff00aa');
  assert.equal(createdThemePalette.accentBlue, '#74aef1');

  const catalogWithTheme = await request(app).get('/api/shop/themes');
  const customTheme = catalogWithTheme.body.find((theme) => theme.value === 'custom-test');
  assert.equal(customTheme.mode, 'light');
  assert.equal(customTheme.labels.fr, 'Thème personnalisé');
  assert.equal(customTheme.preview.accentCyan, '#ff00aa');

  const updateTheme = await auth(request(app).put(`/api/admin/shop/${createTheme.body.id}`), admin)
    .send({ name: 'Custom Theme II', mode: 'dark', palette: { accentCyan: '#00ff00' } });
  assert.equal(updateTheme.status, 200);
  const updatedThemePalette = JSON.parse(updateTheme.body.palette);
  assert.equal(updatedThemePalette.bgPrimary, '#101010');
  assert.equal(updatedThemePalette.accentCyan, '#00ff00');
  assert.equal(updateTheme.body.mode, 'dark');

  const duplicateTheme = await auth(request(app).post('/api/admin/shop'), admin)
    .send({ kind: 'theme', name: 'Duplicate Theme', value: 'dark-02', price: 10 });
  assert.equal(duplicateTheme.status, 409);
  assert.equal(duplicateTheme.body.error, 'This theme value already exists');

  const invalidTheme = await auth(request(app).post('/api/admin/shop'), admin)
    .send({ kind: 'theme', name: 'Invalid Theme', value: 'invalid-theme', palette: { bgPrimary: 'not-a-color' } });
  assert.equal(invalidTheme.status, 400);
  assert.equal(invalidTheme.body.error, 'Invalid theme color: bgPrimary');

  const editDefaultTheme = await auth(request(app).put('/api/admin/shop/theme_dark_01'), admin)
    .send({ palette: { bgPrimary: '#0b0d19' } });
  assert.equal(editDefaultTheme.status, 200);
  assert.equal(JSON.parse(editDefaultTheme.body.palette).bgPrimary, '#0b0d19');

  const deleteTheme = await auth(request(app).delete(`/api/admin/shop/${createTheme.body.id}`), admin);
  assert.equal(deleteTheme.status, 200);

  const createIcon = await auth(request(app).post('/api/admin/shop'), admin)
    .send({ kind: 'profile_icon', value: '🛸', price: 10 });
  assert.equal(createIcon.status, 201);
  assert.equal(createIcon.body.kind, 'profile_icon');
  assert.equal(createIcon.body.value, '🛸');
  assert.equal(createIcon.body.name, '🛸');

  const duplicateIcon = await auth(request(app).post('/api/admin/shop'), admin)
    .send({ kind: 'profile_icon', value: '🛸', price: 10 });
  assert.equal(duplicateIcon.status, 409);
  assert.equal(duplicateIcon.body.error, 'This profile icon already exists');

  db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(10, user.id);
  const buyCustomIcon = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: createIcon.body.id });
  assert.equal(buyCustomIcon.status, 200);
  assert.equal(buyCustomIcon.body.credits, 0);

  const equipCustomIcon = await auth(request(app).post('/api/shop/equip'), token)
    .send({ itemId: createIcon.body.id });
  assert.equal(equipCustomIcon.status, 200);
  assert.equal(equipCustomIcon.body.cosmetics.profile_icon, '🛸');

  const customIconProfile = await auth(request(app).get('/api/auth/me'), token);
  assert.equal(customIconProfile.body.cosmetics.profile_icon, '🛸');

  const editIcon = await auth(request(app).put('/api/admin/shop/icon_smile'), admin)
    .send({ price: 22 });
  assert.equal(editIcon.status, 200);
  assert.equal(editIcon.body.kind, 'profile_icon');
  assert.equal(editIcon.body.name, 'Smile');
  assert.equal(editIcon.body.price, 22);

  const renameIcon = await auth(request(app).put('/api/admin/shop/icon_smile'), admin)
    .send({ name: 'Smile Plus', price: 22 });
  assert.equal(renameIcon.status, 400);
  assert.equal(renameIcon.body.error, 'Only the price of a profile icon can be modified');

  const deleteIcon = await auth(request(app).delete('/api/admin/shop/icon_coffee'), admin);
  assert.equal(deleteIcon.status, 200);

  const editDefault = await auth(request(app).put('/api/admin/shop/piece_classic'), admin)
    .send({ name: 'Changed' });
  assert.equal(editDefault.status, 400);

  const deleteDefault = await auth(request(app).delete('/api/admin/shop/piece_classic'), admin);
  assert.equal(deleteDefault.status, 400);
});

test('Profile icons can be purchased and equipped', async () => {
  const { token, user } = await register('icon_buyer');
  const db = getDatabase();
  db.prepare('UPDATE users SET credits = ? WHERE id = ?').run(200, user.id);

  const catalog = await auth(request(app).get('/api/shop'), token);
  assert.equal(catalog.status, 200);
  assert.equal(catalog.body.cosmetics.profile_icon, 'user');
  assert.equal(catalog.body.items.find((item) => item.id === 'icon_user').owned, true);

  const buy = await auth(request(app).post('/api/shop/purchase'), token)
    .send({ itemId: 'icon_wink' });
  assert.equal(buy.status, 200);
  assert.equal(buy.body.credits, 0);

  const equip = await auth(request(app).post('/api/shop/equip'), token)
    .send({ itemId: 'icon_wink' });
  assert.equal(equip.status, 200);
  assert.equal(equip.body.cosmetics.profile_icon, 'wink');

  const after = await auth(request(app).get('/api/shop'), token);
  assert.equal(after.body.items.find((item) => item.id === 'icon_wink').equipped, true);
  assert.equal(after.body.items.find((item) => item.id === 'icon_user').equipped, false);

  const me = await auth(request(app).get('/api/auth/me'), token);
  assert.equal(me.body.cosmetics.profile_icon, 'wink');
});
