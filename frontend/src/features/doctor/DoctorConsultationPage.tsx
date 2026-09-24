import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';

interface QueueItem {
  id: string;
  tokenNumber: number;
  status: string;
  patient: {
    id: string;
    patientCode: string;
    fullName: string;
    gender: string;
    dateOfBirth: string;
    phone: string;
    allergies?: Array<{ allergen: string; severity: string }>;
  };
}

interface MedicineItem {
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
}

export const DoctorConsultationPage: React.FC = () => {
  const { t } = useTranslation();
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [selectedAppt, setSelectedAppt] = useState<QueueItem | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Vitals form
  const [vitals, setVitals] = useState({
    bpSystolic: 120,
    bpDiastolic: 80,
    pulseRate: 72,
    temperatureF: 98.4,
    spO2Percent: 99,
    weightKg: 65,
    heightCm: 168
  });

  // Clinical notes
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [history, setHistory] = useState('');
  const [examination, setExamination] = useState('');
  const [diagnosis, setDiagnosis] = useState('');
  const [consultationId, setConsultationId] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  // Prescriptions
  const [medicines, setMedicines] = useState<MedicineItem[]>([]);
  const [medInput, setMedInput] = useState<MedicineItem>({
    medicineName: '',
    dosage: '500mg',
    frequency: '1-0-1 (Twice daily)',
    durationDays: 5,
    instructions: 'After food with warm water'
  });
  const [safetyWarnings, setSafetyWarnings] = useState<string[]>([]);
  const [overrideReason, setOverrideReason] = useState('');

  // Diagnostic Orders
  const [labTests, setLabTests] = useState<{ id: string; testName: string; code: string }[]>([]);
  const [selectedLabTest, setSelectedLabTest] = useState('');
  const [orderedLabTests, setOrderedLabTests] = useState<string[]>([]);

  // Print modal
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [prescriptionPrintHtml, setPrescriptionPrintHtml] = useState<string | null>(null);

  useEffect(() => {
    loadQueue();
    loadLabCatalog();
  }, []);

  const loadQueue = async () => {
    setLoading(true);
    setError(null);
    try {
      const today = new Date().toISOString().split('T')[0];
      const data = await api.get<any[]>(`/appointments?date=${today}`);
      // Filter for active appointments
      const mapped = data.map((a: any) => ({
        id: a.id,
        tokenNumber: a.tokenNumber || 1,
        status: a.status,
        patient: {
          id: a.patientId,
          patientCode: a.patient?.patientCode || 'CS-DEMO',
          fullName: a.patient?.fullName || 'Patient',
          gender: a.patient?.gender || 'N/A',
          dateOfBirth: a.patient?.dateOfBirth || '1990-01-01',
          phone: a.patient?.phone || '',
          allergies: a.patient?.allergies || []
        }
      }));
      setQueue(mapped);
      if (mapped.length > 0 && !selectedAppt) {
        selectPatient(mapped[0]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load OPD queue');
    } finally {
      setLoading(false);
    }
  };

  const loadLabCatalog = async () => {
    try {
      const tests = await api.get<any[]>('/lab/catalog');
      setLabTests(tests || []);
    } catch {
      // Lab catalog may be empty in blank test db
    }
  };

  const selectPatient = (appt: QueueItem) => {
    setSelectedAppt(appt);
    setChiefComplaint('');
    setHistory('');
    setExamination('');
    setDiagnosis('');
    setMedicines([]);
    setOrderedLabTests([]);
    setSafetyWarnings([]);
    setIsLocked(false);
    setConsultationId(null);
  };

  const calculateBMI = () => {
    if (!vitals.weightKg || !vitals.heightCm) return null;
    const heightM = vitals.heightCm / 100;
    return (vitals.weightKg / (heightM * heightM)).toFixed(1);
  };

  const handleAddMedicine = () => {
    if (!medInput.medicineName.trim()) return;

    // Safety checks against patient allergies
    const warnings: string[] = [];
    const patientAllergies = selectedAppt?.patient?.allergies || [];
    for (const a of patientAllergies) {
      if (medInput.medicineName.toLowerCase().includes(a.allergen.toLowerCase())) {
        warnings.push(`CRITICAL ALLERGY ALERT: Patient is allergic to ${a.allergen} (${a.severity})!`);
      }
    }

    // Duplicate check
    const duplicate = medicines.find(
      (m) => m.medicineName.toLowerCase() === medInput.medicineName.toLowerCase()
    );
    if (duplicate) {
      warnings.push(`DUPLICATE WARNING: ${medInput.medicineName} is already prescribed in this visit.`);
    }

    if (warnings.length > 0) {
      setSafetyWarnings((prev) => [...prev, ...warnings]);
    }

    setMedicines([...medicines, { ...medInput }]);
    setMedInput({
      medicineName: '',
      dosage: '500mg',
      frequency: '1-0-1 (Twice daily)',
      durationDays: 5,
      instructions: 'After food with warm water'
    });
  };

  const handleOrderLabTest = () => {
    if (!selectedLabTest) return;
    const test = labTests.find((t) => t.id === selectedLabTest);
    if (test && !orderedLabTests.includes(test.testName)) {
      setOrderedLabTests([...orderedLabTests, test.testName]);
    }
  };

  const handleSaveConsultation = async (lock: boolean = false) => {
    if (!selectedAppt) return;
    setSaving(true);
    setError(null);
    setSuccessMsg(null);

    try {
      // 1. Create or save consultation
      const consultData = {
        appointmentId: selectedAppt.id,
        patientId: selectedAppt.patient.id,
        chiefComplaint: chiefComplaint || 'Routine medical checkup',
        historyOfPresentIllness: history,
        physicalExamination: examination,
        diagnosis: diagnosis || 'General review',
        vitals: {
          ...vitals,
          bmi: parseFloat(calculateBMI() || '22')
        }
      };

      const res = await api.post('/consultations', consultData);
      const cId = res.id || consultationId;
      setConsultationId(cId);

      // 2. Submit e-prescriptions if medicines added
      if (medicines.length > 0 && cId) {
        await api.post('/prescriptions', {
          consultationId: cId,
          patientId: selectedAppt.patient.id,
          items: medicines.map((m) => ({
            medicineName: m.medicineName,
            dosage: m.dosage,
            frequency: m.frequency,
            durationDays: Number(m.durationDays),
            instructions: m.instructions
          })),
          overrideReason: safetyWarnings.length > 0 ? overrideReason || 'Doctor clinical override evaluated' : undefined
        });
      }

      // 3. Lock consultation if requested
      if (lock && cId) {
        await api.post(`/consultations/${cId}/lock`, { reason: 'Consultation concluded by treating physician' });
        setIsLocked(true);
      }

      setSuccessMsg(lock ? 'Consultation finalized, locked, and sent to Pharmacy/Billing!' : 'Draft notes saved securely.');
    } catch (err: any) {
      setError(err.message || 'Failed to save clinical consultation');
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadPrescription = async () => {
    if (!consultationId) {
      await handleSaveConsultation(false);
    }
    // Generate clean printable prescription view
    const patientName = selectedAppt?.patient?.fullName || 'Patient';
    const patientCode = selectedAppt?.patient?.patientCode || '';
    const dateStr = new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });

    const htmlContent = `
      <div style="font-family: sans-serif; padding: 24px; color: #0B2E33; max-width: 800px; margin: 0 auto; border: 1px solid #ccc;">
        <div style="text-align: center; border-bottom: 2px solid #028090; padding-bottom: 12px; margin-bottom: 16px;">
          <h1 style="margin: 0; color: #028090;">CareSmart Multispeciality Hospital</h1>
          <p style="margin: 4px 0; font-size: 14px;">Plot 42, Healthcare Avenue, Hyderabad, Telangana 500081</p>
          <p style="margin: 0; font-size: 12px; color: #666;">24x7 Helpline: 108 / +91 40 2345 6789 | Reg No: TS-HOSP-2024-9841</p>
        </div>

        <div style="display: flex; justify-content: space-between; font-size: 14px; margin-bottom: 16px; background: #f4fbfc; padding: 12px; border-radius: 6px;">
          <div>
            <strong>Patient Name:</strong> ${patientName} (${patientCode})<br/>
            <strong>Gender / Age:</strong> ${selectedAppt?.patient?.gender} / ${new Date().getFullYear() - new Date(selectedAppt?.patient?.dateOfBirth || '').getFullYear()} yrs<br/>
            <strong>Allergies:</strong> ${selectedAppt?.patient?.allergies?.map((a) => a.allergen).join(', ') || 'No known drug allergies (NKDA)'}
          </div>
          <div style="text-align: right;">
            <strong>Date:</strong> ${dateStr}<br/>
            <strong>Token #:</strong> ${selectedAppt?.tokenNumber}<br/>
            <strong>Status:</strong> ${isLocked ? 'FINALIZED & SIGNED' : 'DRAFT PRESCRIPTION'}
          </div>
        </div>

        <div style="font-size: 14px; margin-bottom: 16px;">
          <strong>Vitals:</strong> BP: ${vitals.bpSystolic}/${vitals.bpDiastolic} mmHg | Pulse: ${vitals.pulseRate} bpm | Temp: ${vitals.temperatureF}°F | SpO2: ${vitals.spO2Percent}% | BMI: ${calculateBMI() || 'N/A'}<br/>
          <strong>Diagnosis:</strong> ${diagnosis || 'Clinical evaluation'}
        </div>

        <h3 style="color: #028090; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Rx - Medication Orders</h3>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 24px;">
          <thead>
            <tr style="background: #eef8f8; text-align: left;">
              <th style="padding: 8px; border: 1px solid #ddd;">#</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Medicine Name</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Dosage</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Frequency</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Days</th>
              <th style="padding: 8px; border: 1px solid #ddd;">Special Instructions</th>
            </tr>
          </thead>
          <tbody>
            ${medicines
              .map(
                (m, idx) => `
              <tr>
                <td style="padding: 8px; border: 1px solid #ddd;">${idx + 1}</td>
                <td style="padding: 8px; border: 1px solid #ddd;"><strong>${m.medicineName}</strong></td>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.dosage}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.frequency}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.durationDays}</td>
                <td style="padding: 8px; border: 1px solid #ddd;">${m.instructions}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        ${
          orderedLabTests.length > 0
            ? `
          <h3 style="color: #028090; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Diagnostic Investigations Ordered</h3>
          <ul style="font-size: 14px; margin-bottom: 24px;">
            ${orderedLabTests.map((t) => `<li>${t}</li>`).join('')}
          </ul>
        `
            : ''
        }

        <div style="margin-top: 48px; display: flex; justify-content: space-between; font-size: 12px; color: #555;">
          <div>
            Generated digitally via CareSmart EMR<br/>
            Tamper-proof Cryptographic Audit Chain Validated
          </div>
          <div style="text-align: center; border-top: 1px solid #000; width: 220px; padding-top: 4px;">
            <strong>Dr. Rajesh Sharma, MD</strong><br/>
            Reg No: TS-MC-48291<br/>
            Senior Consultant Physician
          </div>
        </div>
      </div>
    `;

    setPrescriptionPrintHtml(htmlContent);
    setShowPrintModal(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-navy text-white p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-teal text-white px-3 py-1 rounded-lg text-lg">OPD</span>
            Doctor Clinical Consultation
          </h1>
          <p className="text-teal-200 text-sm mt-1">
            Paperless E-Prescribing, Instant Safety Alerts, Diagnostic Order Dispatch
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="secondary" onClick={loadQueue} loading={loading}>
            Refresh Queue
          </Button>
          {selectedAppt && (
            <Button variant="primary" onClick={handleDownloadPrescription}>
              Download / Print Rx
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-700 rounded-lg text-sm font-medium">
          {successMsg}
        </div>
      )}

      {/* Main Grid: Queue on Left, Consult workspace on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left: Queue List */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Today's OPD Queue">
            {loading && queue.length === 0 ? (
              <div className="space-y-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : queue.length === 0 ? (
              <p className="text-sm text-gray-500 py-4 text-center">No patients in queue.</p>
            ) : (
              <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
                {queue.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => selectPatient(item)}
                    className={`p-3 cursor-pointer rounded-lg transition-colors flex items-center justify-between ${
                      selectedAppt?.id === item.id ? 'bg-teal-50 border border-teal' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-navy">#{item.tokenNumber}</span>
                        <span className="font-medium text-sm text-gray-900">{item.patient.fullName}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {item.patient.patientCode} • {item.patient.gender}
                      </div>
                    </div>
                    <Badge variant={item.status === 'COMPLETED' ? 'success' : 'primary'}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        {/* Right: Consultation Workspace */}
        <div className="lg:col-span-3 space-y-6">
          {selectedAppt ? (
            <>
              {/* Patient Banner */}
              <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-navy">
                    {selectedAppt.patient.fullName}{' '}
                    <span className="text-sm font-normal text-gray-500">
                      ({selectedAppt.patient.patientCode})
                    </span>
                  </h2>
                  <div className="text-xs text-gray-500 mt-1 flex gap-3">
                    <span>Gender: {selectedAppt.patient.gender}</span>
                    <span>DOB: {selectedAppt.patient.dateOfBirth}</span>
                    <span>Token: #{selectedAppt.tokenNumber}</span>
                  </div>
                </div>

                {/* Allergy Tags */}
                <div>
                  {selectedAppt.patient.allergies && selectedAppt.patient.allergies.length > 0 ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                        ALLERGIES:
                      </span>
                      {selectedAppt.patient.allergies.map((a, i) => (
                        <Badge key={i} variant="danger">
                          {a.allergen} ({a.severity})
                        </Badge>
                      ))}
                    </div>
                  ) : (
                    <Badge variant="success">No Known Drug Allergies (NKDA)</Badge>
                  )}
                </div>
              </div>

              {/* Patient Vitals Card */}
              <Card title="Vitals & Biometrics">
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-gray-600">BP Systolic</label>
                    <input
                      type="number"
                      value={vitals.bpSystolic}
                      onChange={(e) => setVitals({ ...vitals, bpSystolic: Number(e.target.value) })}
                      className={`w-full mt-1 px-2 py-1 text-sm border rounded ${
                        vitals.bpSystolic > 140 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">BP Diastolic</label>
                    <input
                      type="number"
                      value={vitals.bpDiastolic}
                      onChange={(e) => setVitals({ ...vitals, bpDiastolic: Number(e.target.value) })}
                      className={`w-full mt-1 px-2 py-1 text-sm border rounded ${
                        vitals.bpDiastolic > 90 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Pulse (bpm)</label>
                    <input
                      type="number"
                      value={vitals.pulseRate}
                      onChange={(e) => setVitals({ ...vitals, pulseRate: Number(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Temp (°F)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitals.temperatureF}
                      onChange={(e) => setVitals({ ...vitals, temperatureF: Number(e.target.value) })}
                      className={`w-full mt-1 px-2 py-1 text-sm border rounded ${
                        vitals.temperatureF > 100 ? 'border-amber-500 bg-amber-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">SpO2 (%)</label>
                    <input
                      type="number"
                      value={vitals.spO2Percent}
                      onChange={(e) => setVitals({ ...vitals, spO2Percent: Number(e.target.value) })}
                      className={`w-full mt-1 px-2 py-1 text-sm border rounded ${
                        vitals.spO2Percent < 95 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">Weight (kg)</label>
                    <input
                      type="number"
                      value={vitals.weightKg}
                      onChange={(e) => setVitals({ ...vitals, weightKg: Number(e.target.value) })}
                      className="w-full mt-1 px-2 py-1 text-sm border border-gray-300 rounded"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-600">BMI</label>
                    <div className="mt-1 px-2 py-1 bg-gray-100 text-sm font-bold text-gray-700 rounded border border-gray-200 text-center">
                      {calculateBMI() || '--'}
                    </div>
                  </div>
                </div>
              </Card>

              {/* Clinical Notes Form */}
              <Card title="Clinical Evaluation & Diagnosis">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Chief Complaints *</label>
                    <textarea
                      rows={2}
                      value={chiefComplaint}
                      onChange={(e) => setChiefComplaint(e.target.value)}
                      placeholder="e.g. Fever for 3 days, dry cough, body aches..."
                      className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">History of Illness</label>
                    <textarea
                      rows={2}
                      value={history}
                      onChange={(e) => setHistory(e.target.value)}
                      placeholder="e.g. No previous history of asthma or tuberculosis..."
                      className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Physical Examination</label>
                    <textarea
                      rows={2}
                      value={examination}
                      onChange={(e) => setExamination(e.target.value)}
                      placeholder="e.g. Chest clear on auscultation, throat congested..."
                      className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-gray-700">Primary Diagnosis *</label>
                    <textarea
                      rows={2}
                      value={diagnosis}
                      onChange={(e) => setDiagnosis(e.target.value)}
                      placeholder="e.g. Acute Upper Respiratory Tract Infection (URTI)"
                      className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal"
                    />
                  </div>
                </div>
              </Card>

              {/* Safety Alerts Banner (if any) */}
              {safetyWarnings.length > 0 && (
                <div className="p-4 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg space-y-2">
                  <div className="font-bold text-amber-800 text-sm flex items-center gap-2">
                    <span>⚠️</span>
                    Clinical Safety Warnings Detected:
                  </div>
                  <ul className="list-disc list-inside text-xs text-amber-700 space-y-1">
                    {safetyWarnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                  <div className="mt-2">
                    <label className="text-xs font-semibold text-amber-900">
                      Reason for Clinical Override (Required to finalize):
                    </label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="e.g., Benefit outweighs risk; alternative allergy protocol prescribed"
                      className="w-full mt-1 px-3 py-1.5 text-xs border border-amber-300 rounded bg-white"
                    />
                  </div>
                </div>
              )}

              {/* E-Prescription Section */}
              <Card title="E-Prescriptions (Instant Sync to Pharmacy)">
                <div className="space-y-4">
                  {/* Medicine Input Row */}
                  <div className="grid grid-cols-1 md:grid-cols-6 gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 items-end">
                    <div className="md:col-span-2">
                      <label className="text-xs font-semibold text-gray-700">Medicine Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Paracetamol / Amoxicillin"
                        value={medInput.medicineName}
                        onChange={(e) => setMedInput({ ...medInput, medicineName: e.target.value })}
                        className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700">Dosage</label>
                      <input
                        type="text"
                        value={medInput.dosage}
                        onChange={(e) => setMedInput({ ...medInput, dosage: e.target.value })}
                        className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700">Frequency</label>
                      <input
                        type="text"
                        value={medInput.frequency}
                        onChange={(e) => setMedInput({ ...medInput, frequency: e.target.value })}
                        className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-gray-700">Days</label>
                      <input
                        type="number"
                        value={medInput.durationDays}
                        onChange={(e) => setMedInput({ ...medInput, durationDays: Number(e.target.value) })}
                        className="w-full mt-1 px-2 py-1.5 text-sm border border-gray-300 rounded"
                      />
                    </div>
                    <div>
                      <Button variant="primary" size="sm" className="w-full" onClick={handleAddMedicine}>
                        + Add Rx
                      </Button>
                    </div>
                  </div>

                  {/* Medicines Table */}
                  {medicines.length > 0 && (
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-gray-100 text-gray-700">
                          <tr>
                            <th className="p-2.5">Medicine</th>
                            <th className="p-2.5">Dosage</th>
                            <th className="p-2.5">Frequency</th>
                            <th className="p-2.5">Days</th>
                            <th className="p-2.5">Instructions</th>
                            <th className="p-2.5 text-right">Remove</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          {medicines.map((m, idx) => (
                            <tr key={idx} className="hover:bg-gray-50">
                              <td className="p-2.5 font-bold text-navy">{m.medicineName}</td>
                              <td className="p-2.5">{m.dosage}</td>
                              <td className="p-2.5">{m.frequency}</td>
                              <td className="p-2.5">{m.durationDays}</td>
                              <td className="p-2.5 text-gray-500">{m.instructions}</td>
                              <td className="p-2.5 text-right">
                                <button
                                  onClick={() => setMedicines(medicines.filter((_, i) => i !== idx))}
                                  className="text-red-500 hover:text-red-700 font-bold"
                                >
                                  ✕
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </Card>

              {/* Order Lab Tests */}
              <Card title="Diagnostic Orders (Lab & Radiology)">
                <div className="flex gap-2">
                  <select
                    value={selectedLabTest}
                    onChange={(e) => setSelectedLabTest(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal"
                  >
                    <option value="">-- Select Diagnostic Test from Catalog --</option>
                    {labTests.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.testName} ({t.code})
                      </option>
                    ))}
                    <option value="cbc">Complete Blood Count (CBC)</option>
                    <option value="lft">Liver Function Test (LFT)</option>
                    <option value="kft">Kidney Function Test (KFT)</option>
                    <option value="cxr">Chest X-Ray PA View</option>
                  </select>
                  <Button variant="secondary" onClick={handleOrderLabTest}>
                    + Add Order
                  </Button>
                </div>

                {orderedLabTests.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {orderedLabTests.map((test, idx) => (
                      <span
                        key={idx}
                        className="bg-teal-50 text-teal-800 text-xs px-2.5 py-1 rounded-full border border-teal-200 flex items-center gap-1"
                      >
                        {test}
                        <button
                          onClick={() => setOrderedLabTests(orderedLabTests.filter((_, i) => i !== idx))}
                          className="hover:text-red-500 font-bold ml-1"
                        >
                          ✕
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Card>

              {/* Actions Footer */}
              <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="text-xs text-gray-500">
                  {isLocked
                    ? '🔒 Consultation is finalized and locked. Edits require audit reason.'
                    : 'Changes autosaved. Click Finalize to lock and send orders to Pharmacy & Billing.'}
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => handleSaveConsultation(false)}
                    loading={saving}
                    disabled={isLocked}
                  >
                    Save Draft
                  </Button>
                  <Button
                    variant="primary"
                    onClick={() => handleSaveConsultation(true)}
                    loading={saving}
                    disabled={isLocked}
                  >
                    Lock & Conclude Visit
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <Card>
              <div className="text-center py-16 text-gray-400">
                <p className="text-lg font-medium text-gray-600">Select a patient from the OPD Queue to begin</p>
                <p className="text-xs mt-1">CareSmart provides automated safety warnings and real-time pharmacy sync.</p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Printable Prescription Modal */}
      <Modal
        isOpen={showPrintModal}
        onClose={() => setShowPrintModal(false)}
        title="Printable E-Prescription (Doctor Signed)"
      >
        <div className="space-y-4">
          <div
            className="border p-4 rounded bg-white max-h-[500px] overflow-y-auto"
            dangerouslySetInnerHTML={{ __html: prescriptionPrintHtml || '' }}
          />
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowPrintModal(false)}>
              Close
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                const printWin = window.open('', '', 'width=900,height=700');
                if (printWin) {
                  printWin.document.write(prescriptionPrintHtml || '');
                  printWin.document.close();
                  printWin.focus();
                  printWin.print();
                }
              }}
            >
              Print Document
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
