import { PrismaClient, UserStatus, StaffRole } from '@prisma/client';
import argon2 from 'argon2';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding production data...');

  const adminEmail = process.env.ADMIN_INITIAL_EMAIL || 'admin@caresmart.hospital';
  const adminPassword = process.env.ADMIN_INITIAL_PASSWORD || 'CareSmartAdminSecure2026!';
  const adminName = process.env.ADMIN_INITIAL_NAME || 'CareSmart System Administrator';
  const adminPhone = process.env.ADMIN_INITIAL_PHONE || '+919876543210';

  // Check if admin user already exists
  let adminUser = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!adminUser) {
    const passwordHash = await argon2.hash(adminPassword);
    adminUser = await prisma.user.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: adminName,
        phone: adminPhone,
        status: UserStatus.ACTIVE,
        mustChangePassword: true,
        roles: {
          create: {
            role: StaffRole.ADMIN
          }
        }
      }
    });
    console.log(`Initial admin user created: ${adminEmail}`);
  } else {
    console.log(`Admin user already exists: ${adminEmail}`);
  }

  // System Settings Defaults
  const defaultSettings = [
    { key: 'HOSPITAL_NAME', value: 'CareSmart Multispeciality Hospital', category: 'GENERAL', description: 'Official Hospital Name', isPublic: true },
    { key: 'HOSPITAL_CODE', value: 'CS-HYD-01', category: 'GENERAL', description: 'Hospital Registration Code', isPublic: true },
    { key: 'HOSPITAL_PHONE', value: '+91 40 2345 6789', category: 'GENERAL', description: 'Main Hospital Helpline', isPublic: true },
    { key: 'HOSPITAL_ADDRESS', value: 'Plot 42, Health City, Jubilee Hills, Hyderabad, Telangana 500033', category: 'GENERAL', description: 'Hospital Address', isPublic: true },
    { key: 'GSTIN', value: '36AAAAA0000A1Z5', category: 'BILLING', description: 'Hospital GSTIN Number', isPublic: true },
    { key: 'AUTO_DISCOUNT_LIMIT_PAISE', value: '100000', category: 'BILLING', description: 'Maximum discount in paise cashier can apply without admin approval (1000 INR)', isPublic: false },
    { key: 'DAILY_BED_CHARGE_HOUR_UTC', value: '00:00', category: 'IPD', description: 'Time of day when daily IPD bed charges accrue', isPublic: false },
    { key: 'DPDP_DPO_CONTACT', value: 'privacy@caresmart.hospital', category: 'PRIVACY', description: 'Data Protection Officer Contact', isPublic: true },
    { key: 'DPDP_RETENTION_NOTICE', value: 'Clinical records are retained for minimum 3 years per NMC regulations.', category: 'PRIVACY', description: 'Statutory Retention Policy Notice', isPublic: true }
  ];

  for (const s of defaultSettings) {
    await prisma.systemSetting.upsert({
      where: { key: s.key },
      update: {},
      create: s
    });
  }

  console.log('Production seeding completed successfully.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
