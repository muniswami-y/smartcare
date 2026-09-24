import { test, expect } from '@playwright/test';

test.describe('CareSmart Hospital End-to-End System Tests', () => {
  test('1. Public Price Transparency - Search and view tariff catalog', async ({ page }) => {
    await page.goto('/prices');
    await expect(page.locator('h1')).toContainText('Public Medical Services Tariff');
    
    // Search for blood test
    const searchInput = page.getByPlaceholder('Search test, procedure, or code...');
    await searchInput.fill('CBC');
    await expect(page.locator('body')).toContainText('Complete Blood Count');
    await expect(page.locator('body')).toContainText('₹400.00');
  });

  test('2. Staff Authentication - Quick demo role switch and login', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('h1')).toContainText('Hospital Staff Access');

    // Click quick demo login for Doctor
    const doctorButton = page.getByText('Doctor (MD)');
    await doctorButton.click();

    // Verify redirect or form filled
    await expect(page.locator('input[type="email"]')).toHaveValue('doctor@caresmart.in');
  });

  test('3. Patient Portal & Mobile OTP Login', async ({ page }) => {
    await page.goto('/patient/login');
    await expect(page.locator('h1')).toContainText('Patient & Family Portal');

    // Enter test mobile number
    const phoneInput = page.locator('input[type="tel"]');
    await phoneInput.fill('9848012345');
    
    // Request OTP
    const sendOtpButton = page.getByText('Send 6-Digit Verification OTP');
    await sendOtpButton.click();

    // Verify OTP input appears
    await expect(page.locator('body')).toContainText('Enter 6-Digit OTP');
  });

  test('4. Doctor Clinical Consultation - Vitals, E-Prescription & Print View', async ({ page }) => {
    await page.goto('/doctor');
    await expect(page.locator('h1')).toContainText('Doctor Clinical Consultation');

    // Check that clinical vitals card is rendered
    await expect(page.locator('body')).toContainText('Vitals & Biometrics');
    await expect(page.locator('body')).toContainText('Chief Complaints');
  });

  test('5. Pharmacy Dispensing - FEFO batch picking and stock review', async ({ page }) => {
    await page.goto('/pharmacy');
    await expect(page.locator('h1')).toContainText('Prescription Dispensing & FEFO Inventory');
    await expect(page.locator('body')).toContainText('Prescriptions Arriving from Consultation');
  });

  test('6. Laboratory - Barcode phlebotomy worklist and panic flags', async ({ page }) => {
    await page.goto('/lab');
    await expect(page.locator('h1')).toContainText('Laboratory');
    await expect(page.locator('body')).toContainText('Diagnostic Laboratory Worklist');
  });

  test('7. Radiology & Image Viewer - Medical image tools and disclaimers', async ({ page }) => {
    await page.goto('/radiology');
    await expect(page.locator('h1')).toContainText('Diagnostic Imaging & Picture Archiving');
    await expect(page.locator('body')).toContainText('Diagnostic Imaging Studies');
  });

  test('8. Billing Desk - Itemized invoice, concessions, and receipt', async ({ page }) => {
    await page.goto('/billing');
    await expect(page.locator('h1')).toContainText('Cashier Desk, Live Itemized Bills');
    await expect(page.locator('body')).toContainText('Active Inpatient & OPD Bills');
  });

  test('9. Inpatient Bed Board (IPD) - Live ward occupancy and admission', async ({ page }) => {
    await page.goto('/ipd');
    await expect(page.locator('h1')).toContainText('Inpatient Bed Board & Ward Occupancy');
    await expect(page.locator('body')).toContainText('Filter Ward');
  });

  test('10. Admin Dashboard - Realtime KPIs, staff management, and audit integrity', async ({ page }) => {
    await page.goto('/admin');
    await expect(page.locator('h1')).toContainText('Hospital Command & Administrative Oversight');
    await expect(page.locator('body')).toContainText('Monthly OPD Footfall');
    await expect(page.locator('body')).toContainText('Total Net Collections');
  });
});
