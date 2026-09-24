import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { ImageViewer } from '../../components/ImageViewer';

interface ImagingStudy {
  id: string;
  studyNumber: string;
  patientName: string;
  patientCode: string;
  modality: 'XRAY' | 'CT' | 'MRI' | 'USG';
  bodyPart: string;
  source: 'DIGITAL_MACHINE' | 'FILM_SCAN' | 'PHONE_PHOTO';
  status: 'PENDING_UPLOAD' | 'ACQUIRED' | 'REPORTED' | 'SIGNED';
  imageUrl?: string;
  radiologistReport?: string;
  findings?: string;
  impression?: string;
}

export const RadiologyPage: React.FC = () => {
  const { t } = useTranslation();
  const [studies, setStudies] = useState<ImagingStudy[]>([
    {
      id: 'rad-1',
      studyNumber: 'RAD-2026-101',
      patientName: 'Vikram Joshi',
      patientCode: 'CS-000003',
      modality: 'XRAY',
      bodyPart: 'Chest PA View',
      source: 'DIGITAL_MACHINE',
      status: 'ACQUIRED',
      imageUrl: 'https://images.unsplash.com/photo-1516549655169-df83a0774514?auto=format&fit=crop&w=800&q=80',
      findings: 'Both lung fields show normal vascularity. Heart size is within normal limits. Costophrenic angles are clear.',
      impression: 'Normal Chest Radiograph'
    },
    {
      id: 'rad-2',
      studyNumber: 'RAD-2026-102',
      patientName: 'Sunita Devi',
      patientCode: 'CS-000002',
      modality: 'USG',
      bodyPart: 'Whole Abdomen',
      source: 'PHONE_PHOTO',
      status: 'ACQUIRED',
      imageUrl: 'https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=800&q=80',
      findings: 'Liver shows mild fatty infiltration (Grade I). Gallbladder, pancreas, spleen, and kidneys appear normal.',
      impression: 'Mild hepatic steatosis'
    },
    {
      id: 'rad-3',
      studyNumber: 'RAD-2026-103',
      patientName: 'Ramesh Verma',
      patientCode: 'CS-000001',
      modality: 'CT',
      bodyPart: 'Brain NCCT',
      source: 'DIGITAL_MACHINE',
      status: 'PENDING_UPLOAD'
    }
  ]);

  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(studies[0]);
  const [showReportModal, setShowReportModal] = useState(false);
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleSignReport = () => {
    if (!selectedStudy) return;
    setStudies((prev) =>
      prev.map((s) =>
        s.id === selectedStudy.id
          ? {
              ...s,
              status: 'SIGNED',
              findings: findings || s.findings,
              impression: impression || s.impression
            }
          : s
      )
    );
    setShowReportModal(false);
    setStatusMsg({
      type: 'success',
      text: 'Radiology study findings digitally certified and locked with radiologist credentials!'
    });
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-navy text-white p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-teal text-white px-3 py-1 rounded-lg text-lg">Radiology</span>
            Diagnostic Imaging & Picture Archiving (PACS)
          </h1>
          <p className="text-teal-200 text-sm mt-1">
            DICOM Fallback, Film Scan Compliance Notices, Multi-Tool Medical Image Viewer
          </p>
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Studies List */}
        <div className="lg:col-span-1 space-y-4">
          <Card title="Diagnostic Imaging Studies">
            <div className="divide-y divide-gray-100 max-h-[600px] overflow-y-auto">
              {studies.map((s) => (
                <div
                  key={s.id}
                  onClick={() => {
                    setSelectedStudy(s);
                    setFindings(s.findings || '');
                    setImpression(s.impression || '');
                  }}
                  className={`p-3 cursor-pointer rounded-lg transition-colors ${
                    selectedStudy?.id === s.id ? 'bg-teal-50 border border-teal' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="font-mono text-xs font-bold text-navy">{s.studyNumber}</span>
                      <div className="font-bold text-sm text-gray-900">{s.patientName}</div>
                      <div className="text-xs text-teal font-medium">
                        {s.modality} - {s.bodyPart}
                      </div>
                    </div>
                    <Badge variant={s.status === 'SIGNED' ? 'success' : 'primary'}>{s.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: Medical Image Viewer & Reporting */}
        <div className="lg:col-span-2 space-y-6">
          {selectedStudy ? (
            <>
              {/* Compliance Source Disclaimer */}
              {selectedStudy.source === 'PHONE_PHOTO' && (
                <div className="p-3 bg-amber-50 border-l-4 border-amber-500 rounded-r-lg text-xs text-amber-800">
                  <strong>Notice:</strong> This image was captured via mobile camera or film scan. It is
                  intended for rapid clinical consultation only. The signed diagnostic radiology report
                  below constitutes the primary legal and diagnostic authority.
                </div>
              )}

              {/* Advanced Image Viewer */}
              {selectedStudy.imageUrl ? (
                <ImageViewer
                  src={selectedStudy.imageUrl}
                  alt={`${selectedStudy.modality} - ${selectedStudy.bodyPart}`}
                  fileType="IMAGE"
                  sourceType={selectedStudy.source}
                  patientName={`${selectedStudy.patientName} (${selectedStudy.patientCode})`}
                  studyDate="2026-09-24"
                />
              ) : (
                <Card>
                  <div className="text-center py-16 text-gray-500">
                    <p className="font-semibold">Study Pending Image Upload</p>
                    <p className="text-xs mt-1">Upload DICOM, High-Res PNG/JPG or Film Scan to view.</p>
                  </div>
                </Card>
              )}

              {/* Diagnostic Report Card */}
              <Card title="Radiologist Diagnostic Report">
                <div className="space-y-4">
                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Observations & Findings
                    </h4>
                    <p className="text-sm text-gray-800 mt-1 bg-gray-50 p-3 rounded border border-gray-200">
                      {selectedStudy.findings || 'No findings recorded yet.'}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">
                      Impression / Conclusion
                    </h4>
                    <p className="text-sm font-semibold text-navy mt-1 bg-teal-50 p-3 rounded border border-teal-200">
                      {selectedStudy.impression || 'Pending final impression.'}
                    </p>
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <div className="text-xs text-gray-500">
                      {selectedStudy.status === 'SIGNED' ? (
                        <span className="text-green-700 font-bold">
                          ✓ Signed by Dr. Anjali Mehta, DMRD (Radiologist)
                        </span>
                      ) : (
                        <span>Awaiting formal signature</span>
                      )}
                    </div>

                    {selectedStudy.status !== 'SIGNED' && (
                      <Button
                        variant="primary"
                        onClick={() => {
                          setFindings(selectedStudy.findings || '');
                          setImpression(selectedStudy.impression || '');
                          setShowReportModal(true);
                        }}
                      >
                        Edit & Sign Report
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            </>
          ) : (
            <Card>
              <div className="text-center py-20 text-gray-400">
                Select an imaging study from the worklist to launch viewer.
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Write/Sign Report Modal */}
      <Modal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Author Radiology Report & Apply Digital Signature"
      >
        <div className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700">Detailed Findings *</label>
            <textarea
              rows={4}
              value={findings}
              onChange={(e) => setFindings(e.target.value)}
              className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
              placeholder="e.g. Bone architecture intact. No focal consolidation, pneumothorax or effusion..."
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-gray-700">Final Impression *</label>
            <textarea
              rows={2}
              value={impression}
              onChange={(e) => setImpression(e.target.value)}
              className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg font-semibold"
              placeholder="e.g. Normal chest radiograph. No acute cardiopulmonary disease."
            />
          </div>

          <div className="p-3 bg-teal-50 border border-teal-200 rounded text-xs text-teal-800">
            ℹ️ Signing this report locks the findings into the immutable medical record and sends a notification to the patient portal.
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowReportModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" onClick={handleSignReport}>
              Apply Digital Signature & Lock
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
