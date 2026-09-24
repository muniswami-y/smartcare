import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';

interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  patientCode: string;
  gender: string;
  age: number;
}

interface TimelineItem {
  id: string;
  date: string;
  type: 'VISIT' | 'LAB' | 'RADIOLOGY' | 'DISCHARGE';
  title: string;
  doctor: string;
  summary: string;
  isLocked: boolean;
}

interface AccessLogEntry {
  id: string;
  timestamp: string;
  actorName: string;
  role: string;
  purpose: string;
  isBreakGlass: boolean;
}

export const PatientPortalPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'timeline' | 'queue' | 'bills' | 'privacy'>('timeline');

  // Family Members
  const [familyMembers] = useState<FamilyMember[]>([
    {
      id: 'fam-1',
      name: 'Ramesh Verma',
      relationship: 'Self',
      patientCode: 'CS-000001',
      gender: 'Male',
      age: 48
    },
    {
      id: 'fam-2',
      name: 'Sunita Verma',
      relationship: 'Spouse',
      patientCode: 'CS-000002',
      gender: 'Female',
      age: 44
    },
    {
      id: 'fam-3',
      name: 'Aarav Verma',
      relationship: 'Child (Minor)',
      patientCode: 'CS-000005',
      gender: 'Male',
      age: 12
    }
  ]);
  const [selectedMember, setSelectedMember] = useState<FamilyMember>(familyMembers[0]);

  // Health Timeline (Strictly Finalized/Signed Items)
  const [timeline] = useState<TimelineItem[]>([
    {
      id: 'tl-1',
      date: '2026-09-24',
      type: 'LAB',
      title: 'Complete Blood Count (CBC) - Signed Report',
      doctor: 'Dr. Anjali Mehta, MD (Pathology)',
      summary: 'Hemoglobin: 13.5 g/dL, WBC: 7800 /mcL, Platelets: 250,000 /mcL. All counts within physiological limits.',
      isLocked: true
    },
    {
      id: 'tl-2',
      date: '2026-09-22',
      type: 'VISIT',
      title: 'Consultation - General Medicine',
      doctor: 'Dr. Rajesh Sharma, MD',
      summary: 'Diagnosis: Acute Bronchitis. Prescribed Azithromycin 500mg and Steam Inhalation. Advised review in 5 days.',
      isLocked: true
    },
    {
      id: 'tl-3',
      date: '2026-08-15',
      type: 'RADIOLOGY',
      title: 'Chest X-Ray PA View - Diagnostic Certified',
      doctor: 'Dr. Anjali Mehta, DMRD',
      summary: 'Normal bronchovascular markings. Normal cardiac silhouette. No active pulmonary consolidation.',
      isLocked: true
    }
  ]);

  // Access Logs (DPDP Act 2023)
  const [accessLogs] = useState<AccessLogEntry[]>([
    {
      id: 'log-1',
      timestamp: '2026-09-24 10:45 AM',
      actorName: 'Dr. Rajesh Sharma',
      role: 'DOCTOR',
      purpose: 'OPD Clinical Consultation Review',
      isBreakGlass: false
    },
    {
      id: 'log-2',
      timestamp: '2026-09-24 11:30 AM',
      actorName: 'Suman Lata',
      role: 'PHARMACIST',
      purpose: 'Prescription Dispense & Allergy Verification',
      isBreakGlass: false
    },
    {
      id: 'log-3',
      timestamp: '2026-09-24 02:15 PM',
      actorName: 'Pooja Nair',
      role: 'CASHIER',
      purpose: 'Itemized Billing Payment Collection',
      isBreakGlass: false
    }
  ]);

  // Bill payment state
  const [billPaid, setBillPaid] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);
  const [restrictedLocked, setRestrictedLocked] = useState(false);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner with Family Switcher */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-navy text-white p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-teal text-white px-3 py-1 rounded-lg text-lg">Portal</span>
            Patient & Family Health Dashboard
          </h1>
          <p className="text-teal-200 text-sm mt-1">
            Zero-Paper Records, Real-time Queue Tracking, India DPDP Act 2023 Transparency
          </p>
        </div>

        {/* Family Member Switcher */}
        <div className="flex items-center gap-2 bg-navy-800 p-2 rounded-lg border border-teal-800">
          <span className="text-xs text-teal-300 font-semibold">Viewing Record For:</span>
          <select
            value={selectedMember.id}
            onChange={(e) => {
              const mem = familyMembers.find((m) => m.id === e.target.value);
              if (mem) setSelectedMember(mem);
            }}
            className="bg-teal text-white text-xs font-bold px-3 py-1.5 rounded focus:outline-none cursor-pointer"
          >
            {familyMembers.map((m) => (
              <option key={m.id} value={m.id} className="text-black bg-white">
                {m.name} ({m.relationship})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-gray-200 gap-4 text-sm font-semibold">
        <button
          onClick={() => setActiveTab('timeline')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'timeline'
              ? 'border-teal text-teal'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Health Records Timeline
        </button>
        <button
          onClick={() => setActiveTab('queue')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'queue'
              ? 'border-teal text-teal'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Live Token & Wait Time
        </button>
        <button
          onClick={() => setActiveTab('bills')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'bills'
              ? 'border-teal text-teal'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Bills & Online Payments
        </button>
        <button
          onClick={() => setActiveTab('privacy')}
          className={`pb-3 border-b-2 transition-colors ${
            activeTab === 'privacy'
              ? 'border-teal text-teal'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          Privacy & DPDP Rights
        </button>
      </div>

      {/* Tab 1: Health Records Timeline */}
      {activeTab === 'timeline' && (
        <div className="space-y-4">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900 flex justify-between items-center">
            <span>
              🔒 <strong>Verified Medical Record:</strong> Showing signed clinical consultations, authorized pathology reports, and discharge summaries for {selectedMember.name}. Draft notes are never published.
            </span>
          </div>

          <div className="space-y-4">
            {timeline.map((item) => (
              <Card key={item.id}>
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-teal bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                        {item.type}
                      </span>
                      <span className="text-xs text-gray-400">{item.date}</span>
                    </div>
                    <h3 className="text-base font-bold text-navy">{item.title}</h3>
                    <p className="text-xs font-semibold text-gray-600">Signing Authority: {item.doctor}</p>
                    <p className="text-sm text-gray-700 mt-2 bg-gray-50 p-3 rounded border border-gray-100">
                      {item.summary}
                    </p>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => alert(`Downloading verified PDF for ${item.title}...`)}
                  >
                    Download PDF
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Tab 2: Live OPD Queue */}
      {activeTab === 'queue' && (
        <Card title="Live OPD Queue Tracker">
          <div className="text-center py-8 space-y-6">
            <div className="inline-block p-6 bg-teal-50 border-2 border-teal rounded-2xl shadow-sm">
              <div className="text-xs uppercase tracking-wider text-teal-800 font-bold">
                Your Live OPD Token Number
              </div>
              <div className="text-5xl font-extrabold text-navy my-2">#08</div>
              <div className="text-sm font-semibold text-teal-900">
                Dr. Rajesh Sharma, MD (Room 102 - OPD Block A)
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-2xl mx-auto text-center">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500">Currently in Consult</div>
                <div className="text-2xl font-bold text-navy">#05</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500">Patients Ahead of You</div>
                <div className="text-2xl font-bold text-amber-600">2 Patients</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
                <div className="text-xs text-gray-500">Estimated Wait Time</div>
                <div className="text-2xl font-bold text-teal">~ 15 Mins</div>
              </div>
            </div>

            <p className="text-xs text-gray-500 max-w-lg mx-auto">
              Please proceed to Room 102 waiting lounge when token #07 is called. Live queue updates automatically every 10 seconds.
            </p>
          </div>
        </Card>
      )}

      {/* Tab 3: Bills & Online Payment */}
      {activeTab === 'bills' && (
        <Card title="Live Itemized Bill & Digital Payment">
          <div className="space-y-4">
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-3">Charge Description</th>
                    <th className="p-3">Department</th>
                    <th className="p-3 text-right">Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  <tr>
                    <td className="p-3 font-medium">OPD Doctor Specialist Fee</td>
                    <td className="p-3">Consultation</td>
                    <td className="p-3 text-right">₹500.00</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Complete Blood Count (CBC)</td>
                    <td className="p-3">Laboratory</td>
                    <td className="p-3 text-right">₹400.00</td>
                  </tr>
                  <tr>
                    <td className="p-3 font-medium">Pharmacy: Azithromycin 500mg</td>
                    <td className="p-3">Pharmacy</td>
                    <td className="p-3 text-right">₹150.00</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200 flex flex-col items-end text-xs space-y-1">
              <div>Subtotal: ₹1,050.00</div>
              <div>Discount: ₹0.00</div>
              <div className="text-base font-extrabold text-navy">
                Net Outstanding Payable: ₹{billPaid ? '0.00' : '1,050.00'}
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              {billPaid ? (
                <Badge variant="success">✓ Bill Fully Paid via Online UPI</Badge>
              ) : (
                <Button
                  variant="primary"
                  onClick={() => {
                    alert('Simulating Razorpay Test Mode Checkout: Payment of ₹1,050.00 succeeded!');
                    setBillPaid(true);
                  }}
                >
                  Pay ₹1,050.00 Online (UPI / Card)
                </Button>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Tab 4: Privacy & DPDP Act 2023 */}
      {activeTab === 'privacy' && (
        <div className="space-y-6">
          {/* Export Health Records */}
          <Card title="Right to Data Portability (Digital Personal Data Protection Act 2023)">
            <p className="text-xs text-gray-600 mb-3">
              Under Section 12 of India's DPDP Act 2023, you have the full legal right to download your complete, tamper-proof electronic health records in an open digital format.
            </p>
            <div className="flex items-center gap-3">
              <Button
                variant="primary"
                onClick={() =>
                  setExportNotice('Export archive created! Secure 24-hour expiring ZIP download link generated.')
                }
              >
                Request Complete Health Data Archive (ZIP / JSON)
              </Button>
            </div>
            {exportNotice && (
              <div className="mt-3 p-3 bg-green-50 text-green-800 text-xs rounded border border-green-200">
                {exportNotice}
              </div>
            )}
          </Card>

          {/* Restricted Record Locking */}
          <Card title="Restricted Record Confidentiality Lock">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-bold text-navy">Lock Highly Sensitive Health Records</h4>
                <p className="text-xs text-gray-500 mt-1">
                  Enforces secondary consent requirements before mental health or reproductive health records can be viewed by non-treating hospital staff.
                </p>
              </div>
              <Button
                variant={restrictedLocked ? 'danger' : 'outline'}
                size="sm"
                onClick={() => setRestrictedLocked(!restrictedLocked)}
              >
                {restrictedLocked ? '🔒 Records Locked' : '🔓 Unlocked (Standard Access)'}
              </Button>
            </div>
          </Card>

          {/* Access Log: Who accessed my records */}
          <Card title="Transparent Access Log ('Who Viewed My Data')">
            <p className="text-xs text-gray-500 mb-4">
              CareSmart maintains a cryptographically chained audit log. Every staff member who opens your medical file is logged with purpose and timestamp.
            </p>
            <div className="overflow-x-auto border border-gray-200 rounded-lg">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-100 text-gray-700">
                  <tr>
                    <th className="p-3">Staff Name</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Access Purpose</th>
                    <th className="p-3">Date & Time</th>
                    <th className="p-3">Type</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {accessLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50">
                      <td className="p-3 font-semibold text-navy">{log.actorName}</td>
                      <td className="p-3">
                        <Badge variant="outline">{log.role}</Badge>
                      </td>
                      <td className="p-3">{log.purpose}</td>
                      <td className="p-3 font-mono text-gray-500">{log.timestamp}</td>
                      <td className="p-3">
                        {log.isBreakGlass ? (
                          <Badge variant="danger">Emergency Break-Glass</Badge>
                        ) : (
                          <Badge variant="success">Standard Clinical</Badge>
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
    </div>
  );
};
