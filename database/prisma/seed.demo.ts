import {
  PrismaClient,
  UserStatus,
  StaffRole,
  Gender,
  Relationship,
  AllergyType,
  AllergySeverity,
  AppointmentType,
  AppointmentStatus,
  ConsultationStatus,
  MedicineForm,
  PrescriptionStatus,
  OrderType,
  OrderUrgency,
  DiagnosticOrderStatus,
  StockMovementType,
  DispenseStatus,
  TestCategory,
  SampleType,
  SampleStatus,
  ImagingModality,
  ImagingSource,
  ReportStatus,
  ServiceCategory,
  EncounterType,
  ChargeStatus,
  BillStatus,
  PaymentMethod,
  WardType,
  BedStatus,
  AdmissionType,
  AdmissionStatus,
  InpatientOrderType,
  MedicationAdminStatus,
  AuditAction,
  AlertType,
  AlertSeverity
} from '@prisma/client';
import argon2 from 'argon2';
import crypto from 'crypto';

const prisma = new PrismaClient();

function sha256(content: string): string {
  return crypto.createHash('sha256').update(content).digest('hex');
}

async function main() {
  console.log('Seeding comprehensive demo data for CareSmart Hospital...');

  // Reset or clean existing demo data in a clean relational order
  const passwordHash = await argon2.hash('Password123!');

  // 1. Departments
  const generalMed = await prisma.department.upsert({
    where: { code: 'GEN_MED' },
    update: {},
    create: { code: 'GEN_MED', name: 'General Medicine', description: 'Internal & General Medicine' }
  });

  const cardiology = await prisma.department.upsert({
    where: { code: 'CARDIO' },
    update: {},
    create: { code: 'CARDIO', name: 'Cardiology', description: 'Comprehensive Heart & Vascular Care' }
  });

  const orthopedics = await prisma.department.upsert({
    where: { code: 'ORTHO' },
    update: {},
    create: { code: 'ORTHO', name: 'Orthopedics', description: 'Bone, Joint & Trauma Care' }
  });

  const pediatrics = await prisma.department.upsert({
    where: { code: 'PED' },
    update: {},
    create: { code: 'PED', name: 'Pediatrics', description: 'Infant, Child & Adolescent Care' }
  });

  const emergency = await prisma.department.upsert({
    where: { code: 'EMERG' },
    update: {},
    create: { code: 'EMERG', name: 'Emergency & Trauma', description: '24/7 Acute Trauma and Emergency Care' }
  });

  // 2. Staff Users & Roles
  console.log('Creating staff members across all roles...');
  const staffConfigs = [
    { email: 'admin@caresmart.demo', name: 'Dr. Rajesh Rao (Admin)', role: StaffRole.ADMIN, phone: '+919900000001' },
    { email: 'manager.kavitha@caresmart.demo', name: 'Kavitha Narayanan', role: StaffRole.MANAGER, phone: '+919900000002' },
    { email: 'reception@caresmart.demo', name: 'Sunita Sharma (Reception & Billing)', role: StaffRole.RECEPTIONIST, phone: '+919900000003' },
    { email: 'nurse.lakshmi@caresmart.demo', name: 'Sister Lakshmi Bai', role: StaffRole.NURSE, phone: '+919900000004' },
    { email: 'pharmacist.ravi@caresmart.demo', name: 'Ravi Kumar (Chief Pharmacist)', role: StaffRole.PHARMACIST, phone: '+919900000005' },
    { email: 'lab.suresh@caresmart.demo', name: 'Suresh Varma (Lab Senior Tech)', role: StaffRole.LAB_TECH, phone: '+919900000006' },
    { email: 'radiologist.anita@caresmart.demo', name: 'Dr. Anita Desai (Radiologist)', role: StaffRole.RADIOLOGIST, phone: '+919900000007' }
  ];

  const staffUserMap: Record<string, any> = {};

  for (const s of staffConfigs) {
    let u = await prisma.user.findUnique({ where: { email: s.email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: s.email,
          passwordHash,
          fullName: s.name,
          phone: s.phone,
          phoneHash: sha256(s.phone),
          status: UserStatus.ACTIVE,
          roles: {
            create: { role: s.role }
          }
        }
      });
    }
    staffUserMap[s.role] = u;
  }

  // 3. Three Doctors with schedules and profiles
  console.log('Creating 3 doctors with OPD schedules...');
  const doctorData = [
    {
      email: 'dr.sharma@caresmart.demo',
      name: 'Dr. Ramesh Sharma',
      regNo: 'MCI-1998-34821',
      dept: generalMed.id,
      fee: 50000, // 500 INR in paise
      followUp: 30000,
      qual: 'MBBS, MD (General Medicine) - AIIMS New Delhi',
      phone: '+919811100001'
    },
    {
      email: 'dr.reddy@caresmart.demo',
      name: 'Dr. Vikram Reddy',
      regNo: 'APMC-2005-55912',
      dept: cardiology.id,
      fee: 80000, // 800 INR
      followUp: 50000,
      qual: 'MBBS, MD, DM (Cardiology) - NIMS Hyderabad',
      phone: '+919811100002'
    },
    {
      email: 'dr.priya@caresmart.demo',
      name: 'Dr. Priya Sundaram',
      regNo: 'TNMC-2012-78214',
      dept: pediatrics.id,
      fee: 60000, // 600 INR
      followUp: 40000,
      qual: 'MBBS, DCH, DNB (Pediatrics) - CMC Vellore',
      phone: '+919811100003'
    }
  ];

  const doctors: any[] = [];
  for (const doc of doctorData) {
    let u = await prisma.user.findUnique({ where: { email: doc.email } });
    if (!u) {
      u = await prisma.user.create({
        data: {
          email: doc.email,
          passwordHash,
          fullName: doc.name,
          phone: doc.phone,
          phoneHash: sha256(doc.phone),
          status: UserStatus.ACTIVE,
          roles: {
            create: { role: StaffRole.DOCTOR }
          }
        }
      });
    }

    let profile = await prisma.doctorProfile.findUnique({ where: { userId: u.id } });
    if (!profile) {
      profile = await prisma.doctorProfile.create({
        data: {
          userId: u.id,
          departmentId: doc.dept,
          registrationNumber: doc.regNo,
          consultationFeePaise: doc.fee,
          followUpFeePaise: doc.followUp,
          qualifications: doc.qual,
          bio: `Senior consultant with over 15 years clinical excellence. [DEMO PROFILE]`
        }
      });

      // Create weekly schedules (Monday to Saturday: 09:00 - 13:00)
      for (let day = 1; day <= 6; day++) {
        await prisma.doctorSchedule.create({
          data: {
            doctorId: profile.id,
            dayOfWeek: day,
            startTime: '09:00',
            endTime: '13:00',
            slotDurationMinutes: 15,
            maxTokens: 30,
            active: true
          }
        });
      }
    }
    doctors.push({ user: u, profile });
  }

  // 4. Pharmacy Master & Batches
  console.log('Creating pharmacy suppliers and medicines with batches...');
  const supplier = await prisma.supplier.upsert({
    where: { id: 'demo-supplier-1' },
    update: {},
    create: {
      id: 'demo-supplier-1',
      name: 'MedLife Distributors Pvt Ltd',
      contactPerson: 'Mahesh Gupta',
      phone: '+919822200001',
      email: 'orders@medlife.demo',
      gstNumber: '36ABCDE1234F1Z5',
      dlNumber: 'TG-HYD-DL-2023-99881',
      address: 'Moosapet Industrial Area, Hyderabad'
    }
  });

  const medicineDefs = [
    { code: 'MED-001', genericName: 'Paracetamol', brandName: 'Dolo 650', form: MedicineForm.TABLET, strength: '650mg', uom: 'tab', controlled: false, reorder: 100, price: 350 }, // 3.50 INR
    { code: 'MED-002', genericName: 'Amoxicillin + Clavulanic Acid', brandName: 'Augmentin 625 Duo', form: MedicineForm.TABLET, strength: '625mg', uom: 'tab', controlled: false, reorder: 50, price: 2200 },
    { code: 'MED-003', genericName: 'Pantoprazole', brandName: 'Pan 40', form: MedicineForm.TABLET, strength: '40mg', uom: 'tab', controlled: false, reorder: 80, price: 1100 },
    { code: 'MED-004', genericName: 'Metformin Hydrochloride', brandName: 'Glycomet 500 SR', form: MedicineForm.TABLET, strength: '500mg', uom: 'tab', controlled: false, reorder: 100, price: 450 },
    { code: 'MED-005', genericName: 'Atorvastatin', brandName: 'Atorva 10', form: MedicineForm.TABLET, strength: '10mg', uom: 'tab', controlled: false, reorder: 60, price: 1400 },
    { code: 'MED-006', genericName: 'Azithromycin', brandName: 'Azee 500', form: MedicineForm.TABLET, strength: '500mg', uom: 'tab', controlled: false, reorder: 40, price: 2500 },
    { code: 'MED-007', genericName: 'Tramadol HCl', brandName: 'Tramazac 50', form: MedicineForm.CAPSULE, strength: '50mg', uom: 'cap', controlled: true, reorder: 20, price: 1800 },
    { code: 'MED-008', genericName: 'Cough Formula', brandName: 'Ascoril LS Syrup', form: MedicineForm.SYRUP, strength: '100ml', uom: 'bottle', controlled: false, reorder: 15, price: 12500 },
    { code: 'MED-009', genericName: 'Ondansetron', brandName: 'Emeset 4mg', form: MedicineForm.TABLET, strength: '4mg', uom: 'tab', controlled: false, reorder: 30, price: 600 },
    { code: 'MED-010', genericName: 'Normal Saline 0.9%', brandName: 'NS 500ml IV', form: MedicineForm.INJECTION, strength: '500ml', uom: 'bottle', controlled: false, reorder: 50, price: 6500 }
  ];

  const medicines: any[] = [];
  for (const m of medicineDefs) {
    let med = await prisma.medicine.upsert({
      where: { code: m.code },
      update: {},
      create: {
        code: m.code,
        genericName: m.genericName,
        brandName: m.brandName,
        form: m.form,
        strength: m.strength,
        uom: m.uom,
        isControlled: m.controlled,
        reorderLevel: m.reorder
      }
    });

    // Create batches: 1 normal active, 1 near expiry/expired, 1 low stock
    const now = new Date();
    const expiryFuture = new Date(now.getTime() + 365 * 24 * 3600 * 1000);
    const expiryPast = new Date(now.getTime() - 15 * 24 * 3600 * 1000); // 15 days ago

    // Active batch
    const activeBatch = await prisma.medicineBatch.upsert({
      where: {
        medicineId_batchNumber: {
          medicineId: med.id,
          batchNumber: `BAT-${m.code}-24A`
        }
      },
      update: {},
      create: {
        medicineId: med.id,
        batchNumber: `BAT-${m.code}-24A`,
        supplierId: supplier.id,
        purchasePricePaise: Math.round(m.price * 0.7),
        mrpPaise: Math.round(m.price * 1.2),
        salePricePaise: m.price,
        currentStock: m.code === 'MED-007' ? 12 : 250, // low stock for tramadol
        expiryDate: expiryFuture
      }
    });

    // Expired batch for demonstration
    if (m.code === 'MED-001' || m.code === 'MED-006') {
      await prisma.medicineBatch.upsert({
        where: {
          medicineId_batchNumber: {
            medicineId: med.id,
            batchNumber: `BAT-${m.code}-EXP`
          }
        },
        update: {},
        create: {
          medicineId: med.id,
          batchNumber: `BAT-${m.code}-EXP`,
          supplierId: supplier.id,
          purchasePricePaise: Math.round(m.price * 0.7),
          mrpPaise: Math.round(m.price * 1.2),
          salePricePaise: m.price,
          currentStock: 45,
          expiryDate: expiryPast
        }
      });
    }

    medicines.push({ med, activeBatch });
  }

  // 5. Lab & Imaging Test Catalog
  console.log('Creating diagnostic catalog and parameters...');
  const tests = [
    {
      code: 'CBC',
      name: 'Complete Blood Count (CBC) with ESR',
      category: TestCategory.HEMATOLOGY,
      type: OrderType.LAB,
      sampleType: SampleType.BLOOD,
      price: 35000,
      turnaround: 4,
      params: [
        { name: 'Hemoglobin', unit: 'g/dL', maleMin: 13.0, maleMax: 17.5, femaleMin: 12.0, femaleMax: 15.5, childMin: 11.5, childMax: 14.5, criticalLow: 7.0, criticalHigh: 20.0, orderIndex: 1 },
        { name: 'Total Leucocyte Count (TLC)', unit: 'cells/mcL', maleMin: 4000, maleMax: 11000, femaleMin: 4000, femaleMax: 11000, childMin: 5000, childMax: 15000, criticalLow: 2000, criticalHigh: 30000, orderIndex: 2 },
        { name: 'Platelet Count', unit: 'lakhs/mcL', maleMin: 1.5, maleMax: 4.5, femaleMin: 1.5, femaleMax: 4.5, childMin: 1.5, childMax: 4.5, criticalLow: 0.5, criticalHigh: 10.0, orderIndex: 3 }
      ]
    },
    {
      code: 'KFT',
      name: 'Kidney Function Test (KFT / RFT)',
      category: TestCategory.BIOCHEMISTRY,
      type: OrderType.LAB,
      sampleType: SampleType.SERUM,
      price: 65000,
      turnaround: 6,
      params: [
        { name: 'Blood Urea', unit: 'mg/dL', maleMin: 15, maleMax: 45, femaleMin: 15, femaleMax: 40, childMin: 10, childMax: 35, criticalLow: 5, criticalHigh: 100, orderIndex: 1 },
        { name: 'Serum Creatinine', unit: 'mg/dL', maleMin: 0.7, maleMax: 1.3, femaleMin: 0.6, femaleMax: 1.1, childMin: 0.3, childMax: 0.8, criticalLow: 0.2, criticalHigh: 4.0, orderIndex: 2 },
        { name: 'Serum Uric Acid', unit: 'mg/dL', maleMin: 3.5, maleMax: 7.2, femaleMin: 2.6, femaleMax: 6.0, childMin: 2.0, childMax: 5.5, criticalLow: 1.5, criticalHigh: 12.0, orderIndex: 3 }
      ]
    },
    {
      code: 'FBS',
      name: 'Fasting Blood Sugar',
      category: TestCategory.BIOCHEMISTRY,
      type: OrderType.LAB,
      sampleType: SampleType.BLOOD,
      price: 15000,
      turnaround: 2,
      params: [
        { name: 'Fasting Glucose', unit: 'mg/dL', maleMin: 70, maleMax: 99, femaleMin: 70, femaleMax: 99, childMin: 70, childMax: 100, criticalLow: 50, criticalHigh: 400, orderIndex: 1 }
      ]
    },
    {
      code: 'XRAY-CHEST',
      name: 'Chest X-Ray PA View',
      category: TestCategory.RADIOLOGY_XRAY,
      type: OrderType.IMAGING,
      sampleType: SampleType.NA,
      price: 50000,
      turnaround: 2,
      params: []
    },
    {
      code: 'USG-ABD',
      name: 'Ultrasound Whole Abdomen & Pelvis',
      category: TestCategory.RADIOLOGY_USG,
      type: OrderType.IMAGING,
      sampleType: SampleType.NA,
      price: 150000,
      turnaround: 4,
      params: []
    }
  ];

  const testCatalogMap: Record<string, any> = {};
  for (const t of tests) {
    let cat = await prisma.testCatalog.upsert({
      where: { code: t.code },
      update: {},
      create: {
        code: t.code,
        name: t.name,
        category: t.category,
        type: t.type,
        sampleType: t.sampleType,
        pricePaise: t.price,
        turnAroundHours: t.turnaround
      }
    });

    for (const p of t.params) {
      const existing = await prisma.labParameter.findFirst({
        where: { testCatalogId: cat.id, name: p.name }
      });
      if (!existing) {
        await prisma.labParameter.create({
          data: {
            testCatalogId: cat.id,
            name: p.name,
            unit: p.unit,
            maleMin: p.maleMin,
            maleMax: p.maleMax,
            femaleMin: p.femaleMin,
            femaleMax: p.femaleMax,
            childMin: p.childMin,
            childMax: p.childMax,
            criticalLow: p.criticalLow,
            criticalHigh: p.criticalHigh,
            orderIndex: p.orderIndex
          }
        });
      }
    }
    testCatalogMap[t.code] = cat;
  }

  // 6. Wards and Beds
  console.log('Creating IPD Wards and Beds...');
  const wardDefs = [
    { code: 'GEN-MALE', name: 'General Ward - Male', type: WardType.GENERAL_MALE, floor: 1, rate: 80000, bedCount: 10 },
    { code: 'GEN-FEMALE', name: 'General Ward - Female', type: WardType.GENERAL_FEMALE, floor: 1, rate: 80000, bedCount: 10 },
    { code: 'SEMI-PVT', name: 'Semi-Private AC Ward', type: WardType.SEMI_PRIVATE, floor: 2, rate: 200000, bedCount: 8 },
    { code: 'ICU-MAIN', name: 'Intensive Care Unit (ICU)', type: WardType.ICU, floor: 3, rate: 600000, bedCount: 6 }
  ];

  const allBeds: any[] = [];
  for (const w of wardDefs) {
    const ward = await prisma.ward.upsert({
      where: { code: w.code },
      update: {},
      create: {
        code: w.code,
        name: w.name,
        type: w.type,
        floor: w.floor,
        dailyRatePaise: w.rate
      }
    });

    for (let i = 1; i <= w.bedCount; i++) {
      const bedNumber = `${w.code.split('-')[0]}-${i.toString().padStart(2, '0')}`;
      const bed = await prisma.bed.upsert({
        where: {
          wardId_bedNumber: {
            wardId: ward.id,
            bedNumber
          }
        },
        update: {},
        create: {
          wardId: ward.id,
          bedNumber,
          status: BedStatus.AVAILABLE
        }
      });
      allBeds.push({ bed, ward });
    }
  }

  // 7. 20 Patients with full clinical context
  console.log('Creating 20 demo patients with family groups & allergies...');
  const patientProfiles = [
    { code: 'CS-000001', name: 'Aarav Sharma', gender: Gender.MALE, age: 34, phone: '+919876543001', bg: 'B+', allergy: 'Penicillin' },
    { code: 'CS-000002', name: 'Sita Sharma', gender: Gender.FEMALE, age: 31, phone: '+919876543001', bg: 'O+', allergy: null }, // Family of Aarav
    { code: 'CS-000003', name: 'Rohan Sharma', gender: Gender.MALE, age: 6, phone: '+919876543001', bg: 'B+', allergy: 'Dust' },   // Minor child
    { code: 'CS-000004', name: 'Venkat Rao', gender: Gender.MALE, age: 62, phone: '+919876543004', bg: 'A+', allergy: 'Sulfa drugs' },
    { code: 'CS-000005', name: 'Padmavathi Rao', gender: Gender.FEMALE, age: 58, phone: '+919876543004', bg: 'A+', allergy: null },
    { code: 'CS-000006', name: 'Kiran Kumar', gender: Gender.MALE, age: 29, phone: '+919876543006', bg: 'AB+', allergy: null },
    { code: 'CS-000007', name: 'Pooja Reddy', gender: Gender.FEMALE, age: 27, phone: '+919876543007', bg: 'O-', allergy: 'Aspirin' },
    { code: 'CS-000008', name: 'Ananya Verma', gender: Gender.FEMALE, age: 41, phone: '+919876543008', bg: 'B-', allergy: null },
    { code: 'CS-000009', name: 'Mohammed Farooq', gender: Gender.MALE, age: 53, phone: '+919876543009', bg: 'O+', allergy: null },
    { code: 'CS-000010', name: 'Fatima Farooq', gender: Gender.FEMALE, age: 48, phone: '+919876543009', bg: 'B+', allergy: null },
    { code: 'CS-000011', name: 'Rajendra Prasad', gender: Gender.MALE, age: 71, phone: '+919876543011', bg: 'A-', allergy: 'Ibuprofen' },
    { code: 'CS-000012', name: 'Meenakshi Iyer', gender: Gender.FEMALE, age: 36, phone: '+919876543012', bg: 'O+', allergy: null },
    { code: 'CS-000013', name: 'Ganesh Gaitonde', gender: Gender.MALE, age: 45, phone: '+919876543013', bg: 'B+', allergy: null },
    { code: 'CS-000014', name: 'Sunita Patil', gender: Gender.FEMALE, age: 50, phone: '+919876543014', bg: 'AB-', allergy: null },
    { code: 'CS-000015', name: 'Devendra Singh', gender: Gender.MALE, age: 38, phone: '+919876543015', bg: 'O+', allergy: null },
    { code: 'CS-000016', name: 'Deepika Nair', gender: Gender.FEMALE, age: 25, phone: '+919876543016', bg: 'A+', allergy: 'Egg Protein' },
    { code: 'CS-000017', name: 'Naveen Chandra', gender: Gender.MALE, age: 33, phone: '+919876543017', bg: 'B+', allergy: null },
    { code: 'CS-000018', name: 'Swathi Chowdary', gender: Gender.FEMALE, age: 28, phone: '+919876543018', bg: 'O+', allergy: null },
    { code: 'CS-000019', name: 'Karthik Raja', gender: Gender.MALE, age: 22, phone: '+919876543019', bg: 'A+', allergy: null },
    { code: 'CS-000020', name: 'Bhavani Shankar', gender: Gender.MALE, age: 67, phone: '+919876543020', bg: 'O-', allergy: 'Ciprofloxacin' }
  ];

  const createdPatients: any[] = [];
  for (const p of patientProfiles) {
    let pat = await prisma.patient.findUnique({ where: { patientCode: p.code } });
    if (!pat) {
      pat = await prisma.patient.create({
        data: {
          patientCode: p.code,
          fullName: p.name,
          gender: p.gender,
          ageYears: p.age,
          phone: p.phone,
          phoneHash: sha256(p.phone),
          bloodGroup: p.bg,
          email: `${p.code.toLowerCase()}@example.demo`,
          address: 'H.No 12-4, Madhapur, Hyderabad, Telangana [DEMO]',
          notes: 'Registered for CareSmart Hospital outpatient care.'
        }
      });

      // Patient Account for OTP Portal
      let account = await prisma.patientAccount.findUnique({
        where: { phoneHash: sha256(p.phone) }
      });
      if (!account) {
        account = await prisma.patientAccount.create({
          data: {
            phone: p.phone,
            phoneHash: sha256(p.phone)
          }
        });
      }

      // Family group relationship
      let rel = Relationship.SELF;
      let isGuardian = false;
      if (p.code === 'CS-000002') rel = Relationship.SPOUSE;
      if (p.code === 'CS-000003') {
        rel = Relationship.CHILD;
        isGuardian = true;
      }
      if (p.code === 'CS-000005') rel = Relationship.SPOUSE;
      if (p.code === 'CS-000010') rel = Relationship.SPOUSE;

      await prisma.familyGroup.upsert({
        where: {
          primaryAccountId_patientId: {
            primaryAccountId: account.id,
            patientId: pat.id
          }
        },
        update: {},
        create: {
          primaryAccountId: account.id,
          patientId: pat.id,
          relationship: rel,
          isGuardian: isGuardian,
          canManageConsents: true
        }
      });

      // Allergy record if present
      if (p.allergy) {
        await prisma.patientAllergy.create({
          data: {
            patientId: pat.id,
            allergen: p.allergy,
            allergenType: AllergyType.DRUG,
            severity: AllergySeverity.SEVERE,
            reactions: 'Erythematous rash, bronchospasm, facial edema'
          }
        });
      }
    }
    createdPatients.push(pat);
  }

  // 8. Appointments & Consultations
  console.log('Creating appointments, consultations and prescriptions...');
  for (let i = 0; i < 12; i++) {
    const pat = createdPatients[i];
    const doc = doctors[i % 3];
    const apptCode = `APT-${20240001 + i}`;

    const appt = await prisma.appointment.upsert({
      where: { appointmentCode: apptCode },
      update: {},
      create: {
        appointmentCode: apptCode,
        patientId: pat.id,
        doctorId: doc.profile.id,
        departmentId: doc.profile.departmentId,
        appointmentDate: new Date(),
        slotStartTime: `${9 + (i % 4)}:00`,
        slotEndTime: `${9 + (i % 4)}:15`,
        tokenNumber: i + 1,
        type: AppointmentType.SCHEDULED,
        status: AppointmentStatus.COMPLETED
      }
    });

    // Create Consultation
    const consultCode = `CNS-${20240001 + i}`;
    const consult = await prisma.consultation.upsert({
      where: { consultationCode: consultCode },
      update: {},
      create: {
        consultationCode: consultCode,
        appointmentId: appt.id,
        patientId: pat.id,
        doctorId: doc.profile.id,
        chiefComplaint: 'Recurrent fever with chills, body ache, and mild headache for 3 days.',
        historyOfPresentIllness: 'Patient developed fever 3 days ago. No cough, chest pain, or dysuria.',
        examinationNotes: 'BP 124/82 mmHg, Pulse 88/min, Temp 100.4°F, Chest clear, Per abdomen soft, non-tender.',
        diagnosis: 'Acute Viral Febrile Illness with dehydration',
        status: ConsultationStatus.LOCKED,
        lockedAt: new Date()
      }
    });

    // Nurse Vitals
    await prisma.vitals.create({
      data: {
        patientId: pat.id,
        consultationId: consult.id,
        systolicBp: 124,
        diastolicBp: 82,
        pulseRate: 88,
        temperatureFahrenheit: 100.4,
        spo2Percentage: 98,
        respiratoryRate: 18,
        weightKg: 68.5,
        heightCm: 172.0,
        bmi: 23.1,
        isAbnormal: true,
        abnormalNotes: 'Low grade pyrexia'
      }
    });

    // Prescription
    const rxCode = `RX-${20240001 + i}`;
    const rx = await prisma.prescription.upsert({
      where: { prescriptionCode: rxCode },
      update: {},
      create: {
        prescriptionCode: rxCode,
        consultationId: consult.id,
        patientId: pat.id,
        doctorId: doc.profile.id,
        status: PrescriptionStatus.DISPENSED,
        items: {
          create: [
            {
              medicineId: medicines[0].med.id, // Dolo 650
              dosage: '650mg',
              frequency: 'TDS',
              durationDays: 5,
              instructions: 'Take after food for fever or pain',
              quantity: 15,
              dispensedQuantity: 15
            },
            {
              medicineId: medicines[2].med.id, // Pan 40
              dosage: '40mg',
              frequency: 'OD',
              durationDays: 5,
              instructions: 'Take 30 minutes before breakfast',
              quantity: 5,
              dispensedQuantity: 5
            }
          ]
        }
      }
    });

    // Lab order
    if (i < 6) {
      const orderCode = `ORD-${20240001 + i}`;
      const diagOrder = await prisma.diagnosticOrder.upsert({
        where: { orderCode },
        update: {},
        create: {
          orderCode,
          consultationId: consult.id,
          patientId: pat.id,
          doctorId: doc.profile.id,
          orderType: OrderType.LAB,
          testCatalogId: testCatalogMap['CBC'].id,
          urgency: OrderUrgency.ROUTINE,
          status: DiagnosticOrderStatus.COMPLETED
        }
      });

      // Sample
      const sample = await prisma.sample.upsert({
        where: { sampleBarcode: `SMP-24-${1000 + i}` },
        update: {},
        create: {
          sampleBarcode: `SMP-24-${1000 + i}`,
          diagnosticOrderId: diagOrder.id,
          patientId: pat.id,
          testCatalogId: testCatalogMap['CBC'].id,
          sampleType: SampleType.BLOOD,
          status: SampleStatus.COLLECTED
        }
      });

      // Lab Result
      const params = await prisma.labParameter.findMany({ where: { testCatalogId: testCatalogMap['CBC'].id } });
      for (const p of params) {
        await prisma.labResult.create({
          data: {
            diagnosticOrderId: diagOrder.id,
            sampleId: sample.id,
            parameterId: p.id,
            value: p.name === 'Hemoglobin' ? '14.2' : p.name === 'Total Leucocyte Count (TLC)' ? '8200' : '2.8',
            unit: p.unit,
            isAbnormal: false,
            isCritical: false
          }
        });
      }

      // Signed Report
      await prisma.report.upsert({
        where: { reportCode: `REP-${20240001 + i}` },
        update: {},
        create: {
          reportCode: `REP-${20240001 + i}`,
          diagnosticOrderId: diagOrder.id,
          patientId: pat.id,
          signingStaffId: staffUserMap[StaffRole.RADIOLOGIST].id,
          reportType: OrderType.LAB,
          status: ReportStatus.SIGNED,
          findings: 'Hemoglobin and total leukocyte counts are within physiological reference intervals.',
          impression: 'Normocytic, normochromic blood picture. No toxic granules.',
          signedAt: new Date()
        }
      });
    }

    // Bill
    const billNum = `BILL-24-${1000 + i}`;
    const bill = await prisma.bill.upsert({
      where: { billNumber: billNum },
      update: {},
      create: {
        billNumber: billNum,
        patientId: pat.id,
        encounterType: EncounterType.OPD,
        encounterId: consult.id,
        status: BillStatus.FINALIZED,
        subtotalPaise: 85000,
        discountPaise: 0,
        taxPaise: 0,
        totalPaise: 85000,
        paidPaise: 85000,
        balancePaise: 0,
        finalizedAt: new Date(),
        items: {
          create: [
            { description: 'OPD Doctor Consultation Fee', quantity: 1, unitPricePaise: 50000, totalPaise: 50000 },
            { description: 'Complete Blood Count (CBC)', quantity: 1, unitPricePaise: 35000, totalPaise: 35000 }
          ]
        },
        payments: {
          create: [
            {
              receiptNumber: `REC-24-${1000 + i}`,
              patientId: pat.id,
              amountPaise: 85000,
              paymentMethod: PaymentMethod.UPI,
              transactionReference: `UPI-TXN-${990000 + i}`,
              receivedAt: new Date()
            }
          ]
        }
      }
    });
  }

  // 9. Eight Admitted IPD Patients
  console.log('Admitting 8 patients to IPD beds with notes, vitals and orders...');
  for (let b = 0; b < 8; b++) {
    const pat = createdPatients[12 + b];
    const bedInfo = allBeds[b];
    const doc = doctors[b % 3];
    const admCode = `ADM-24-${5000 + b}`;

    // Mark bed as occupied
    await prisma.bed.update({
      where: { id: bedInfo.bed.id },
      data: { status: BedStatus.OCCUPIED }
    });

    const adm = await prisma.admission.upsert({
      where: { admissionCode: admCode },
      update: {},
      create: {
        admissionCode: admCode,
        patientId: pat.id,
        primaryDoctorId: doc.profile.id,
        admittingDoctorId: doc.profile.id,
        wardId: bedInfo.ward.id,
        bedId: bedInfo.bed.id,
        admissionDate: new Date(Date.now() - (b + 1) * 24 * 3600 * 1000),
        admissionType: b === 0 ? AdmissionType.EMERGENCY : AdmissionType.PLANNED,
        status: AdmissionStatus.ADMITTED,
        diagnosis: b % 2 === 0 ? 'Acute Exacerbation of Bronchial Asthma' : 'Acute Gastroenteritis with moderate dehydration',
        bedAssignments: {
          create: {
            bedId: bedInfo.bed.id,
            assignedAt: new Date(Date.now() - (b + 1) * 24 * 3600 * 1000)
          }
        },
        progressNotes: {
          create: [
            {
              doctorId: doc.profile.id,
              note: 'Morning rounds: Patient hemodynamically stable. Dyspnea improving. Continue current IV hydration and bronchodilators.',
              noteTime: new Date()
            }
          ]
        },
        ipdVitals: {
          create: [
            {
              recordedAt: new Date(),
              systolicBp: 118,
              diastolicBp: 76,
              pulseRate: 78,
              temperatureFahrenheit: 98.6,
              spo2Percentage: 99,
              respiratoryRate: 16,
              urineOutputMl: 800,
              notes: 'Stable condition'
            }
          ]
        },
        inpatientOrders: {
          create: [
            {
              doctorId: doc.profile.id,
              orderType: InpatientOrderType.MEDICATION,
              details: 'IV Ceftriaxone 1g BD, IV Pantoprazole 40mg OD, IV Fluids 100ml/hr NS'
            }
          ]
        }
      }
    });

    // IPD deposit
    await prisma.deposit.create({
      data: {
        depositNumber: `DEP-24-${7000 + b}`,
        patientId: pat.id,
        ipdAdmissionId: adm.id,
        amountPaise: 1000000, // 10,000 INR
        paymentMethod: PaymentMethod.CARD,
        status: 'AVAILABLE'
      }
    });
  }

  // 10. 30 Days of Daily Activity Snapshots for Analytics Charts
  console.log('Generating 30 days of daily snapshots for dashboard analytics...');
  const baseDate = new Date();
  for (let day = 30; day >= 0; day--) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - day);
    const dateStr = d.toISOString().split('T')[0];

    const visits = 20 + Math.floor(Math.sin(day) * 8) + (day % 5);
    const admissions = 2 + (day % 3);
    const rev = (visits * 65000) + (admissions * 120000);

    await prisma.dailySnapshot.upsert({
      where: { snapshotDate: dateStr },
      update: {},
      create: {
        snapshotDate: dateStr,
        totalPatients: 20 + (30 - day) * 3,
        totalVisits: visits,
        totalAdmissions: admissions,
        currentOccupancy: 8 + (day % 4),
        totalRevenuePaise: BigInt(rev),
        pendingRevenuePaise: BigInt(Math.round(rev * 0.15)),
        labOrdersCompleted: Math.round(visits * 0.7),
        pharmacyDispenses: Math.round(visits * 0.9),
        metricsJson: JSON.stringify({
          opdFootfall: visits,
          noShowRatePct: 4.5,
          avgWaitingTimeMinutes: 18,
          bedOccupancyPct: 72.5
        })
      }
    });
  }

  // 11. Initial Audit Logs with verified cryptographic hash chain
  console.log('Initializing cryptographic hash-chained audit logs...');
  let prevHash = '0000000000000000000000000000000000000000000000000000000000000000';
  const initialAuditEvents = [
    { action: AuditAction.LOGIN, resource: 'SYSTEM', detail: 'System initialized with demo clinical datasets' },
    { action: AuditAction.CREATE, resource: 'DEPARTMENT', detail: 'Configured 5 clinical departments' },
    { action: AuditAction.CREATE, resource: 'DOCTOR_SCHEDULE', detail: 'Doctor consultation schedules activated' },
    { action: AuditAction.CREATE, resource: 'PRICE_CATALOG', detail: 'Standard OPD, Lab and Imaging price lists configured' }
  ];

  for (const evt of initialAuditEvents) {
    const timestamp = new Date();
    const metadataStr = JSON.stringify({ note: evt.detail, demo: true });
    const chainContent = [
      prevHash,
      'ANONYMOUS',
      'NONE',
      evt.action,
      evt.resource,
      'NONE',
      timestamp.toISOString(),
      metadataStr
    ].join('|');
    const recordHash = sha256(chainContent);

    await prisma.auditLog.create({
      data: {
        previousHash: prevHash,
        recordHash,
        timestamp,
        action: evt.action,
        resourceType: evt.resource,
        metadataJson: metadataStr,
        ipAddress: '127.0.0.1',
        userAgent: 'CareSmart Demo Seeder'
      }
    });

    prevHash = recordHash;
  }

  // 12. Rule-Based Alert demonstration
  await prisma.adminAlert.create({
    data: {
      alertType: AlertType.LOW_STOCK,
      severity: AlertSeverity.HIGH,
      message: 'Medication Tramadol HCl 50mg (MED-007) is below reorder threshold (Current: 12, Reorder: 20)',
      status: 'OPEN'
    }
  });

  console.log('Demo data seeded successfully! All demo records created with realistic Indian hospital workflows.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
