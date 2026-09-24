import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app';
import { getDatabaseClient, AdmissionStatus } from '@caresmart/database';

const app = createApp();
const prisma = getDatabaseClient();

describe('IPD Concurrency & Bed Invariants', () => {
  it('retrieves live bed board for reception and clinical staff', async () => {
    const login = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'reception@caresmart.demo', password: 'Password123!' });

    const token = login.body.data.accessToken;

    const res = await request(app)
      .get('/api/v1/ipd/bed-board')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  it('rejects double admission of an already admitted patient', async () => {
    const login = await request(app)
      .post('/api/v1/auth/staff/login')
      .send({ email: 'reception@caresmart.demo', password: 'Password123!' });

    const token = login.body.data.accessToken;

    const activeAdm = await prisma.admission.findFirst({
      where: { status: AdmissionStatus.ADMITTED }
    });

    if (activeAdm) {
      const res = await request(app)
        .post('/api/v1/ipd/admissions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          patientId: activeAdm.patientId,
          primaryDoctorId: activeAdm.primaryDoctorId,
          admittingDoctorId: activeAdm.admittingDoctorId,
          wardId: activeAdm.wardId,
          bedId: activeAdm.bedId,
          diagnosis: 'Secondary duplicate admission attempt'
        });

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe('PATIENT_ALREADY_ADMITTED');
    }
  });
});
