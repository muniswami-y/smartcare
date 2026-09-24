import { PrismaClient, StaffRole, UserStatus, AuditAction } from '@prisma/client';
import argon2 from 'argon2';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const dbUrl = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/caresmart?schema=public';
process.env.DATABASE_URL = dbUrl;

const prisma = new PrismaClient({
  datasources: { db: { url: dbUrl } }
});

async function cleanDataKeepAdmin() {
  console.log('--- Cleaning all existing data except Admin user ---');

  // 1. Identify Admin User
  let admin = await prisma.user.findFirst({
    where: {
      OR: [
        { email: 'smartcare@caresmart.demo' },
        { email: 'admin@caresmart.demo' },
        { roles: { some: { role: StaffRole.ADMIN } } }
      ]
    },
    include: { roles: true }
  });

  const passwordHash = await argon2.hash('smartcare');

  if (!admin) {
    console.log('No existing admin found. Creating primary admin user...');
    admin = await prisma.user.create({
      data: {
        email: 'smartcare@caresmart.demo',
        fullName: 'CareSmart Administrator (Admin)',
        passwordHash,
        phone: '+919848011111',
        phoneHash: 'admin_phone_hash_001',
        status: UserStatus.ACTIVE,
        roles: {
          create: { role: StaffRole.ADMIN }
        }
      },
      include: { roles: true }
    });
  } else {
    // Ensure password is reset to known smartcare and active
    await prisma.user.update({
      where: { id: admin.id },
      data: {
        email: 'smartcare@caresmart.demo',
        fullName: 'CareSmart Administrator (Admin)',
        passwordHash,
        status: UserStatus.ACTIVE,
        mustChangePassword: false,
        failedLoginAttempts: 0,
        lockedUntil: null
      }
    });
    console.log(`Preserving Admin user: ${admin.email} (ID: ${admin.id})`);
  }

  const adminId = admin.id;

  // 2. Cascade delete clinical, diagnostic, and billing records in reverse dependency order
  console.log('Deleting notifications, logs, and alerts...');
  await prisma.inAppNotification.deleteMany({});
  await prisma.notificationPreference.deleteMany({});
  await prisma.adminAlert.deleteMany({});
  await prisma.exportLog.deleteMany({});
  await prisma.jobRun.deleteMany({});
  await prisma.dailySnapshot.deleteMany({});

  console.log('Deleting clinical, diagnostic, and imaging records...');
  // Lab & Imaging
  await prisma.shareLink.deleteMany({});
  await prisma.report.deleteMany({});
  await prisma.mediaFile.deleteMany({});
  await prisma.imagingStudy.deleteMany({});
  await prisma.labResult.deleteMany({});
  await prisma.sample.deleteMany({});
  await prisma.diagnosticOrder.deleteMany({});

  // Inpatient (IPD)
  console.log('Deleting IPD records and resetting beds...');
  await prisma.medicationAdministration.deleteMany({});
  await prisma.medicationSchedule.deleteMany({});
  await prisma.inpatientOrder.deleteMany({});
  await prisma.ipdVitals.deleteMany({});
  await prisma.progressNote.deleteMany({});
  await prisma.dischargeSummary.deleteMany({});
  await prisma.dischargeChecklist.deleteMany({});
  await prisma.attendingDoctorAssignment.deleteMany({});
  await prisma.bedAssignment.deleteMany({});
  await prisma.admission.deleteMany({});

  // Reset Bed states to AVAILABLE
  await prisma.bed.updateMany({
    data: { status: 'AVAILABLE' }
  });

  // Pharmacy & Prescriptions
  console.log('Deleting pharmacy and prescription records...');
  await prisma.dispenseItem.deleteMany({});
  await prisma.dispenseRecord.deleteMany({});
  await prisma.stockMovement.deleteMany({});
  await prisma.prescriptionItem.deleteMany({});
  await prisma.prescription.deleteMany({});

  // Clinical OPD
  console.log('Deleting OPD consultations and vitals...');
  await prisma.vitals.deleteMany({});
  await prisma.consultation.deleteMany({});

  // Billing & Payments
  console.log('Deleting billing, payment, and financial records...');
  await prisma.creditNote.deleteMany({});
  await prisma.refund.deleteMany({});
  await prisma.payment.deleteMany({});
  await prisma.deposit.deleteMany({});
  await prisma.discount.deleteMany({});
  await prisma.billItem.deleteMany({});
  await prisma.insuranceClaim.deleteMany({});
  await prisma.pendingCharge.deleteMany({});
  await prisma.bill.deleteMany({});
  await prisma.cashierShift.deleteMany({});

  // Appointments & Schedules
  console.log('Deleting appointments and doctor schedules...');
  await prisma.appointment.deleteMany({});
  await prisma.dailyTokenCounter.deleteMany({});
  await prisma.leaveBlock.deleteMany({});
  await prisma.doctorSchedule.deleteMany({});
  await prisma.doctorProfile.deleteMany({});

  // Patients & Privacy & Portal
  console.log('Deleting patients, patient accounts, and DPDP records...');
  await prisma.patientAllergy.deleteMany({});
  await prisma.consentRecord.deleteMany({});
  await prisma.restrictedRecordSetting.deleteMany({});
  await prisma.dataRequest.deleteMany({});
  await prisma.otpChallenge.deleteMany({});
  await prisma.patientSession.deleteMany({});
  await prisma.familyGroup.deleteMany({});
  await prisma.patient.deleteMany({});
  await prisma.patientAccount.deleteMany({});

  // Disable AuditLog triggers temporarily to allow cascade cleanup of demo audit records
  console.log('Temporarily disabling AuditLog immutability triggers for administrative clean-slate...');
  await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER trg_audit_log_prevent_update;');
  await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" DISABLE TRIGGER trg_audit_log_prevent_delete;');

  console.log('Deleting audit logs...');
  await prisma.auditLog.deleteMany({});

  // Non-admin Staff and Sessions
  console.log('Removing non-admin staff users and sessions...');
  await prisma.session.deleteMany({
    where: { userId: { not: adminId } }
  });

  await prisma.staffRoleAssignment.deleteMany({
    where: { userId: { not: adminId } }
  });

  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { not: adminId } }
  });

  console.log(`Deleted ${deletedUsers.count} non-admin staff users.`);

  // Re-enable AuditLog immutability triggers
  console.log('Re-enabling AuditLog immutability triggers...');
  await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER trg_audit_log_prevent_update;');
  await prisma.$executeRawUnsafe('ALTER TABLE "AuditLog" ENABLE TRIGGER trg_audit_log_prevent_delete;');

  // Log system initialization audit entry
  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: AuditAction.DELETE,
      resourceType: 'SYSTEM',
      resourceId: 'CLEAN_SLATE',
      recordHash: 'INITIAL_CLEAN_SLATE_ADMIN_HASH',
      metadataJson: JSON.stringify({ note: 'Demo data cleaned. Production slate initialized with Admin only.' })
    }
  });

  console.log('--- Database cleanup complete! Only Admin account remains. ---');
}

cleanDataKeepAdmin()
  .catch((e) => {
    console.error('Cleanup error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
