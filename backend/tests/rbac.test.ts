import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Central RBAC & Deny-by-Default Tests', () => {
  it('denies unauthenticated requests by default with 401', async () => {
    const res = await request(app).get('/api/v1/patients/search');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('denies unauthorized staff role from accessing administrative routes with 403', async () => {
    // Login as receptionist
    const loginRes = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'reception@caresmart.demo', password: 'Password123!' });

    const token = loginRes.body.data.accessToken;

    // Attempt to access admin staff management
    const res = await request(app)
      .post('/api/v1/admin/staff')
      .set('Authorization', `Bearer ${token}`)
      .send({ email: 'fake@caresmart.demo', fullName: 'Fake User', temporaryPassword: 'Pass12345!', roles: ['NURSE'] });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN_INSUFFICIENT_ROLE');
  });

  it('allows authenticated admin to access admin endpoints', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'admin@caresmart.demo', password: 'Password123!' });

    const token = loginRes.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/admin/staff')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });
});
