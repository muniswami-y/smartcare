import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getDatabaseClient } from '@caresmart/database';

const app = createApp();
const prisma = getDatabaseClient();

describe('Auth & Session Integration Tests', () => {
  it('rejects login with invalid staff credentials', async () => {
    const res = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'admin@caresmart.demo', password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('authenticates valid staff login and issues JWT tokens and session', async () => {
    const res = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'admin@caresmart.demo', password: 'Password123!' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.accessToken).toBeDefined();
    expect(res.body.data.user.email).toBe('admin@caresmart.demo');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('processes patient OTP request with uniform response', async () => {
    const res = await request(app)
      .post('/api/v1/auth/patient/otp/request')
      .send({ phone: '+919876543001' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.expiresInSeconds).toBe(300);
  });

  it('rejects invalid OTP verification', async () => {
    const res = await request(app)
      .post('/api/v1/auth/patient/otp/verify')
      .send({ phone: '+919876543001', otp: '000000' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
