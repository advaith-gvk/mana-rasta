/**
 * Core integration tests for Mana Rasta API.
 * Run with: npm test (from backend directory)
 * Requires: TEST_DATABASE_URL and TEST_REDIS_URL env vars.
 */

const request = require('supertest');
const app     = require('../src/app');
const { query } = require('../src/config/db');

let authToken;
let adminToken;
let testReportId;

describe('Auth', () => {
  it('POST /auth/send-otp — rejects invalid phone', async () => {
    const res = await request(app).post('/api/v1/auth/send-otp').send({ phone: '12345' });
    expect(res.status).toBe(400);
  });

  it('POST /auth/send-otp — accepts valid +91 phone', async () => {
    const res = await request(app).post('/api/v1/auth/send-otp').send({ phone: '+919876543210' });
    // In test env, OTP is logged, not sent via SMS
    expect([200, 429]).toContain(res.status);
  });

  it('POST /auth/verify-otp — rejects wrong OTP', async () => {
    const res = await request(app)
      .post('/api/v1/auth/verify-otp')
      .send({ phone: '+919876543210', otp: '000000' });
    expect(res.status).toBe(400);
  });
});

describe('Reports (authenticated)', () => {
  beforeAll(async () => {
    // Create test user directly in DB for testing
    await query(`
      INSERT INTO users(id, phone, role, is_active, is_verified)
      VALUES('test-user-id', '+910000000001', 'citizen', TRUE, TRUE)
      ON CONFLICT DO NOTHING
    `);
    await query(`INSERT INTO user_profiles(user_id) VALUES('test-user-id') ON CONFLICT DO NOTHING`);
    await query(`INSERT INTO reward_wallets(user_id) VALUES('test-user-id') ON CONFLICT DO NOTHING`);

    const jwt = require('jsonwebtoken');
    authToken = jwt.sign({ sub: 'test-user-id', role: 'citizen' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  it('GET /reports — returns empty list for new user', async () => {
    const res = await request(app)
      .get('/api/v1/reports')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('GET /reports/nearby — requires lat/lng', async () => {
    const res = await request(app)
      .get('/api/v1/reports/nearby')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(400);
  });

  it('GET /reports/nearby — returns array for valid coords', async () => {
    const res = await request(app)
      .get('/api/v1/reports/nearby?lat=17.4&lng=78.4')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /reports — rejects submission without image', async () => {
    const res = await request(app)
      .post('/api/v1/reports')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ latitude: 17.4, longitude: 78.4, severity: 'high' });
    expect(res.status).toBe(400);
  });
});

describe('Geo', () => {
  beforeAll(async () => {
    if (!authToken) {
      const jwt = require('jsonwebtoken');
      authToken = jwt.sign({ sub: 'test-user-id', role: 'citizen' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    }
  });

  it('GET /geo/resolve — resolves coords within GHMC', async () => {
    const res = await request(app)
      .get('/api/v1/geo/resolve?lat=17.4&lng=78.4')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('ward_id');
  });

  it('GET /geo/viewport — returns reports in bbox', async () => {
    const res = await request(app)
      .get('/api/v1/geo/viewport?minLat=17.3&maxLat=17.5&minLng=78.3&maxLng=78.6')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

describe('Rewards', () => {
  beforeAll(async () => {
    if (!authToken) {
      const jwt = require('jsonwebtoken');
      authToken = jwt.sign({ sub: 'test-user-id', role: 'citizen' }, process.env.JWT_SECRET, { expiresIn: '1h' });
    }
  });

  it('GET /rewards/wallet — returns wallet state', async () => {
    const res = await request(app)
      .get('/api/v1/rewards/wallet')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('balance');
  });

  it('GET /rewards/badges — returns achievement list', async () => {
    const res = await request(app)
      .get('/api/v1/rewards/badges')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /rewards/catalog — returns reward catalog', async () => {
    const res = await request(app)
      .get('/api/v1/rewards/catalog')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /rewards/redeem — rejects with insufficient points', async () => {
    const catalogRes = await request(app)
      .get('/api/v1/rewards/catalog')
      .set('Authorization', `Bearer ${authToken}`);
    if (!catalogRes.body.length) return;

    const firstItem = catalogRes.body[0];
    const res = await request(app)
      .post('/api/v1/rewards/redeem')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ catalogId: firstItem.id });
    expect(res.status).toBe(500); // expects "Insufficient points" error
  });
});

describe('Admin', () => {
  beforeAll(async () => {
    await query(`
      INSERT INTO users(id, email, role, is_active, is_verified)
      VALUES('test-admin-id', 'admin@test.com', 'admin', TRUE, TRUE)
      ON CONFLICT DO NOTHING
    `);
    const jwt = require('jsonwebtoken');
    adminToken = jwt.sign({ sub: 'test-admin-id', role: 'admin' }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });

  it('GET /admin/reports — returns priority queue', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('data');
  });

  it('GET /admin/analytics — returns analytics summary', async () => {
    const res = await request(app)
      .get('/api/v1/admin/analytics')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
  });

  it('GET /admin/sla — returns SLA dashboard', async () => {
    const res = await request(app)
      .get('/api/v1/admin/sla')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /admin/reports — blocks non-admin', async () => {
    const res = await request(app)
      .get('/api/v1/admin/reports')
      .set('Authorization', `Bearer ${authToken}`);
    expect(res.status).toBe(403);
  });
});

afterAll(async () => {
  // Cleanup test data
  await query(`DELETE FROM users WHERE id IN ('test-user-id', 'test-admin-id')`).catch(() => {});
  const { pool } = require('../src/config/db');
  await pool.end();
});
