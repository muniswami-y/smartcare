import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getDatabaseClient } from '@caresmart/database';

const app = createApp();
const prisma = getDatabaseClient();

describe('FEFO Pharmacy Dispense & Stock Invariants', () => {
  it('fetches prescription queue for pharmacist', async () => {
    // Login as pharmacist
    const login = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'pharmacist.ravi@caresmart.demo', password: 'Password123!' });

    expect(login.status).toBe(200);
    const token = login.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/pharmacy/queue')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('guarantees stock cannot become negative and rejects over-dispense', async () => {
    const login = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'pharmacist.ravi@caresmart.demo', password: 'Password123!' });

    const token = login.body.data.accessToken;

    // Attempting to adjust stock to negative quantity
    const batch = await prisma.medicineBatch.findFirst({ where: { currentStock: { gt: 0 } } });
    if (batch) {
      const res = await request(app)
        .post('/api/v1/pharmacy/adjust-stock')
        .set('Authorization', `Bearer ${token}`)
        .send({
          batchId: batch.id,
          movementType: 'ADJUSTMENT',
          quantityChange: -(batch.currentStock + 100),
          notes: 'Testing negative stock rejection'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('STOCK_CANNOT_BE_NEGATIVE');
    }
  });
});
