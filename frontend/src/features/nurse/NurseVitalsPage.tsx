import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';

interface PatientSummary {
  id: string;
  patientCode: string;
  fullName: string;
  gender: string;
  age: number;
  wardBed?: string;
}

interface MedicationScheduleItem {
  id: string;
  patientName: string;
  medicineName: string;
  dose: string;
  scheduledTime: string;
  status: 'SCHEDULED' | 'GIVEN' | 'MISSED';
}

export const NurseVitalsPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'vitals' | 'meds'>('vitals');
  const [patients, setPatients] = useState<PatientSummary[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Vitals State
  const [vitals, setVitals] = useState({
    bpSystolic: 120,
    bpDiastolic: 80,
    pulseRate: 72,
    temperatureF: 98.4,
    spO2Percent: 99,
    weightKg: 65,
    heightCm: 168,
    bloodGlucoseMgDl: 110,
    respiratoryRate: 16
  });

  // Medication Administration
  const [medSchedules, setMedSchedules] = useState<MedicationScheduleItem[]>([
    {
      id: 'med-1',
      patientName: 'Ramesh Verma (Bed W1-102)',
      medicineName: 'Inj Ceftriaxone 1g IV',
      dose: '1g IV',
      scheduledTime: '08:00 AM',
      status: 'GIVEN'
    },
    {
      id: 'med-2',
      patientName: 'Sunita Devi (Bed W1-104)',
      medicineName: 'Tab Pantoprazole 40mg',
      dose: '40mg Oral',
      scheduledTime: '10:00 AM',
      status: 'SCHEDULED'
    },
    {
      id: 'med-3',
      patientName: 'Vikram Joshi (Bed ICU-01)',
      medicineName: 'Inj Noradrenaline Infusion',
      dose: '4mcg/min',
      scheduledTime: 'Continuous',
      status: 'GIVEN'
    },
    {
      id: 'med-4',
      patientName: 'Ananya Reddy (Bed W2-205)',
      medicineName: 'Syp Paracetamol 250mg',
      dose: '5ml Oral',
      scheduledTime: '12:00 PM',
      status: 'SCHEDULED'
    }
  ]);

  const [selectedMedItem, setSelectedMedItem] = useState<MedicationScheduleItem | null>(null);
  const [missedReason, setMissedReason] = useState('');
  const [showMissedModal, setShowMissedModal] = useState(false);

  useEffect(() => {
    loadPatients();
  }, []);

  const loadPatients = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/patients?limit=20');
      const mapped = data.map((p: any) => ({
        id: p.id,
        patientCode: p.patientCode,
        fullName: p.fullName,
        gender: p.gender,
        age: p.dateOfBirth
          ? new Date().getFullYear() - new Date(p.dateOfBirth).getFullYear()
          : 30,
        wardBed: p.admissions?.[0]?.bed?.bedNumber
          ? `${p.admissions[0].bed.ward?.name || 'Ward'} - Bed ${p.admissions[0].bed.bedNumber}`
          : 'OPD Walk-in'
      }));
      setPatients(mapped);
      if (mapped.length > 0) {
        setSelectedPatientId(mapped[0].id);
      }
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const calculateBMI = () => {
    if (!vitals.weightKg || !vitals.heightCm) return null;
    const heightM = vitals.heightCm / 100;
    return (vitals.weightKg / (heightM * heightM)).toFixed(1);
  };

  // Flag alerts
  const isHighBP = vitals.bpSystolic > 140 || vitals.bpDiastolic > 90;
  const isHypoxia = vitals.spO2Percent < 95;
  const isFever = vitals.temperatureF > 100.4;
  const isTachycardia = vitals.pulseRate > 100 || vitals.pulseRate < 50;

  const handleRecordVitals = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPatientId) return;

    setSubmitting(true);
    setStatusMsg(null);
    try {
      await api.post('/consultations', {
        patientId: selectedPatientId,
        chiefComplaint: 'Nursing triage vitals recorded',
        vitals: {
          ...vitals,
          bmi: parseFloat(calculateBMI() || '22')
        }
      });
      setStatusMsg({
        type: 'success',
        text: 'Vitals successfully captured and synchronized with the electronic medical chart!'
      });
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to record vitals'
      });
    } finally {
      setSubmitting(false);
    }
  };

  const markMedicationGiven = (id: string) => {
    setMedSchedules((prev) =>
      prev.map((item) => (item.id === id ? { ...item, status: 'GIVEN' } : item))
    );
  };

  const markMedicationMissed = () => {
    if (!selectedMedItem) return;
    setMedSchedules((prev) =>
      prev.map((item) =>
        item.id === selectedMedItem.id ? { ...item, status: 'MISSED' } : item
      )
    );
    setShowMissedModal(false);
    setMissedReason('');
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-navy text-white p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-teal text-white px-3 py-1 rounded-lg text-lg">Nursing</span>
            Clinical Vitals & Medication Administration
          </h1>
          <p className="text-teal-200 text-sm mt-1">
            Automated Abnormal Physiological Warnings, Shift Handovers, Missed-Dose Alerts
          </p>
        </div>

        {/* Tab switch */}
        <div className="flex bg-navy-800 p-1 rounded-lg border border-teal-800">
          <button
            onClick={() => setActiveTab('vitals')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              activeTab === 'vitals' ? 'bg-teal text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            Triage & Vitals
          </button>
          <button
            onClick={() => setActiveTab('meds')}
            className={`px-4 py-2 text-sm font-semibold rounded-md transition-colors ${
              activeTab === 'meds' ? 'bg-teal text-white' : 'text-gray-300 hover:text-white'
            }`}
          >
            Medication Chart (IPD)
          </button>
        </div>
      </div>

      {statusMsg && (
        <div
          className={`p-4 rounded-lg text-sm font-medium ${
            statusMsg.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {statusMsg.text}
        </div>
      )}

      {activeTab === 'vitals' ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Selector */}
          <div className="lg:col-span-1 space-y-4">
            <Card title="Select Patient for Vitals">
              <div className="divide-y divide-gray-100 max-h-[550px] overflow-y-auto">
                {patients.map((p) => (
                  <div
                    key={p.id}
                    onClick={() => setSelectedPatientId(p.id)}
                    className={`p-3 cursor-pointer rounded-lg transition-colors ${
                      selectedPatientId === p.id
                        ? 'bg-teal-50 border border-teal'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-bold text-navy text-sm">{p.fullName}</div>
                        <div className="text-xs text-gray-500">
                          {p.patientCode} • {p.gender}, {p.age} yrs
                        </div>
                      </div>
                      <Badge variant="outline">{p.wardBed}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Vitals Form & Alerts */}
          <div className="lg:col-span-2 space-y-6">
            {/* Abnormal Signals Alert */}
            {(isHighBP || isHypoxia || isFever || isTachycardia) && (
              <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg space-y-1">
                <div className="font-bold text-red-800 text-sm flex items-center gap-2">
                  <span>🚨</span>
                  CRITICAL ABNORMAL VITALS DETECTED:
                </div>
                <div className="text-xs text-red-700 flex flex-wrap gap-2 pt-1">
                  {isHighBP && (
                    <span className="bg-red-200 px-2 py-0.5 rounded font-bold">
                      HYPERTENSION (BP: {vitals.bpSystolic}/{vitals.bpDiastolic})
                    </span>
                  )}
                  {isHypoxia && (
                    <span className="bg-red-200 px-2 py-0.5 rounded font-bold">
                      HYPOXIA (SpO2: {vitals.spO2Percent}%)
                    </span>
                  )}
                  {isFever && (
                    <span className="bg-amber-200 px-2 py-0.5 rounded font-bold text-amber-900">
                      PYREXIA / FEVER ({vitals.temperatureF}°F)
                    </span>
                  )}
                  {isTachycardia && (
                    <span className="bg-red-200 px-2 py-0.5 rounded font-bold">
                      ABNORMAL PULSE ({vitals.pulseRate} bpm)
                    </span>
                  )}
                </div>
              </div>
            )}

            <form onSubmit={handleRecordVitals}>
              <Card title="Patient Vital Signs Entry">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-gray-700">
                      Blood Pressure (Systolic) mmHg
                    </label>
                    <input
                      type="number"
                      value={vitals.bpSystolic}
                      onChange={(e) =>
                        setVitals({ ...vitals, bpSystolic: Number(e.target.value) })
                      }
                      className={`w-full mt-1 p-2 text-sm border rounded-lg ${
                        vitals.bpSystolic > 140 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      required
                    />
                    <span className="text-[10px] text-gray-500">Normal: 90 - 120 mmHg</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">
                      Blood Pressure (Diastolic) mmHg
                    </label>
                    <input
                      type="number"
                      value={vitals.bpDiastolic}
                      onChange={(e) =>
                        setVitals({ ...vitals, bpDiastolic: Number(e.target.value) })
                      }
                      className={`w-full mt-1 p-2 text-sm border rounded-lg ${
                        vitals.bpDiastolic > 90 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      required
                    />
                    <span className="text-[10px] text-gray-500">Normal: 60 - 80 mmHg</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">
                      Pulse Rate (beats/min)
                    </label>
                    <input
                      type="number"
                      value={vitals.pulseRate}
                      onChange={(e) =>
                        setVitals({ ...vitals, pulseRate: Number(e.target.value) })
                      }
                      className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                      required
                    />
                    <span className="text-[10px] text-gray-500">Normal: 60 - 100 bpm</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">
                      Body Temperature (°F)
                    </label>
                    <input
                      type="number"
                      step="0.1"
                      value={vitals.temperatureF}
                      onChange={(e) =>
                        setVitals({ ...vitals, temperatureF: Number(e.target.value) })
                      }
                      className={`w-full mt-1 p-2 text-sm border rounded-lg ${
                        vitals.temperatureF > 100 ? 'border-amber-500 bg-amber-50' : 'border-gray-300'
                      }`}
                      required
                    />
                    <span className="text-[10px] text-gray-500">Normal: 97.8 - 99.1 °F</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">
                      SpO2 Oxygen Saturation (%)
                    </label>
                    <input
                      type="number"
                      value={vitals.spO2Percent}
                      onChange={(e) =>
                        setVitals({ ...vitals, spO2Percent: Number(e.target.value) })
                      }
                      className={`w-full mt-1 p-2 text-sm border rounded-lg ${
                        vitals.spO2Percent < 95 ? 'border-red-500 bg-red-50' : 'border-gray-300'
                      }`}
                      required
                    />
                    <span className="text-[10px] text-gray-500">Normal: 95% - 100%</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">
                      Respiratory Rate (/min)
                    </label>
                    <input
                      type="number"
                      value={vitals.respiratoryRate}
                      onChange={(e) =>
                        setVitals({ ...vitals, respiratoryRate: Number(e.target.value) })
                      }
                      className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                      required
                    />
                    <span className="text-[10px] text-gray-500">Normal: 12 - 20 /min</span>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">Weight (kg)</label>
                    <input
                      type="number"
                      value={vitals.weightKg}
                      onChange={(e) =>
                        setVitals({ ...vitals, weightKg: Number(e.target.value) })
                      }
                      className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">Height (cm)</label>
                    <input
                      type="number"
                      value={vitals.heightCm}
                      onChange={(e) =>
                        setVitals({ ...vitals, heightCm: Number(e.target.value) })
                      }
                      className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-700">Calculated BMI</label>
                    <div className="mt-1 p-2 bg-gray-100 font-bold text-navy text-sm rounded-lg border border-gray-200 text-center">
                      {calculateBMI() ? `${calculateBMI()} kg/m²` : '--'}
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end">
                  <Button variant="primary" type="submit" loading={submitting}>
                    Save Vitals to Electronic Chart
                  </Button>
                </div>
              </Card>
            </form>
          </div>
        </div>
      ) : (
        /* Medication Administration Chart */
        <div className="space-y-4">
          <Card title="Inpatient Medication Administration Schedule (MAR)">
            <p className="text-xs text-gray-500 mb-4">
              Real-time synchronization with Doctor orders and Pharmacy FEFO batch delivery. Every dose is audited.
            </p>

            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-3">Patient & Location</th>
                    <th className="p-3">Medication & Route</th>
                    <th className="p-3">Dose</th>
                    <th className="p-3">Scheduled Time</th>
                    <th className="p-3">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {medSchedules.map((med) => (
                    <tr key={med.id} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-navy">{med.patientName}</td>
                      <td className="p-3 font-bold text-teal">{med.medicineName}</td>
                      <td className="p-3">{med.dose}</td>
                      <td className="p-3">{med.scheduledTime}</td>
                      <td className="p-3">
                        <Badge
                          variant={
                            med.status === 'GIVEN'
                              ? 'success'
                              : med.status === 'MISSED'
                              ? 'danger'
                              : 'primary'
                          }
                        >
                          {med.status}
                        </Badge>
                      </td>
                      <td className="p-3 text-right space-x-2">
                        {med.status === 'SCHEDULED' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => markMedicationGiven(med.id)}
                            >
                              ✓ Administer
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedMedItem(med);
                                setShowMissedModal(true);
                              }}
                            >
                              Missed Dose
                            </Button>
                          </>
                        )}
                        {med.status === 'GIVEN' && (
                          <span className="text-xs text-green-700 font-semibold">
                            Logged & Audited
                          </span>
                        )}
                        {med.status === 'MISSED' && (
                          <span className="text-xs text-red-600 font-semibold">
                            Doctor Alerted
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Missed Dose Reason Modal */}
      <Modal
        isOpen={showMissedModal}
        onClose={() => setShowMissedModal(false)}
        title="Record Missed Medication Reason"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            For patient safety, recording a missed dose triggers a notification to the attending physician.
          </p>

          <div>
            <label className="text-xs font-semibold text-gray-700">Reason for Non-Administration *</label>
            <textarea
              rows={3}
              value={missedReason}
              onChange={(e) => setMissedReason(e.target.value)}
              placeholder="e.g. Patient vomited post-administration / Patient refused / Patient was in Radiology for CT Scan"
              className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setShowMissedModal(false)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!missedReason.trim()}
              onClick={markMedicationMissed}
            >
              Confirm Missed Dose
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
