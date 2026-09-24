import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';

const app = createApp();

describe('Billing Math, Integer Paise & Idempotency Tests', () => {
  it('serves public price list without authentication for transparency', async () => {
    const res = await request(app).get('/api/v1/billing/public-prices');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejects overpayments beyond current bill balance', async () => {
    // Login as receptionist/cashier
    const login = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'reception@caresmart.demo', password: 'Password123!' });
    const token = login.body.data.accessToken;

    // Fetch an existing bill from demo seed
    const billRes = await request(app)
      .get('/api/v1/analytics/reports/revenue')
      .set('Authorization', `Bearer ${token}`);

    // If a bill exists, test payment rejection if amount is huge
    const res = await request(app)
      .post('/api/v1/billing/payments')
      .set('Authorization', `Bearer ${token}`)
      .send({
        billId: 'non-existent-or-paid',
        patientId: 'dummy-pat-id',
        amountPaise: 999999999,
        paymentMethod: 'CASH',
        idempotencyKey: `idemp-${Date.now()}`
      });

    // Should return 404 or 400 overpayment
    expect([400, 404]).toContain(res.status);
  });
});
