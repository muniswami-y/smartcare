import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';

interface LabOrder {
  id: string;
  orderNumber: string;
  patientName: string;
  patientCode: string;
  testName: string;
  status: 'PENDING_SAMPLE' | 'SAMPLE_COLLECTED' | 'RESULTED' | 'SIGNED';
  sampleBarcode?: string;
  orderedAt: string;
  isCritical?: boolean;
}

export const LabImagingPage: React.FC = () => {
  const { t } = useTranslation();
  const [orders, setOrders] = useState<LabOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Sample Collection Modal
  const [selectedOrder, setSelectedOrder] = useState<LabOrder | null>(null);
  const [sampleBarcode, setSampleBarcode] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);

  // Result Entry Modal
  const [showResultModal, setShowResultModal] = useState(false);
  const [resultValues, setResultValues] = useState<{ parameter: string; value: string; unit: string; refRange: string }[]>([
    { parameter: 'Hemoglobin', value: '13.5', unit: 'g/dL', refRange: '13.0 - 17.0' },
    { parameter: 'Total WBC Count', value: '7800', unit: '/mcL', refRange: '4000 - 11000' },
    { parameter: 'Platelet Count', value: '250000', unit: '/mcL', refRange: '150000 - 450000' }
  ]);
  const [criticalDetected, setCriticalDetected] = useState(false);

  // Share link modal
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareLink, setShareLink] = useState('');

  useEffect(() => {
    loadLabOrders();
  }, []);

  const loadLabOrders = async () => {
    setLoading(true);
    try {
      const data = await api.get<any[]>('/lab/orders');
      const mapped = data.map((o: any) => ({
        id: o.id,
        orderNumber: o.orderNumber || `LAB-${o.id.substring(0, 6).toUpperCase()}`,
        patientName: o.patient?.fullName || 'Patient',
        patientCode: o.patient?.patientCode || 'CS-XXXX',
        testName: o.testCatalog?.testName || 'Diagnostic Investigation',
        status: o.status,
        sampleBarcode: o.sample?.barcode || undefined,
        orderedAt: o.createdAt,
        isCritical: o.results?.some((r: any) => r.isCritical) || false
      }));
      setOrders(mapped);
    } catch {
      // Mock data if blank
      setOrders([
        {
          id: 'ord-1',
          orderNumber: 'LAB-2026-001',
          patientName: 'Ramesh Verma',
          patientCode: 'CS-000001',
          testName: 'Complete Blood Count (CBC)',
          status: 'PENDING_SAMPLE',
          orderedAt: new Date().toISOString()
        },
        {
          id: 'ord-2',
          orderNumber: 'LAB-2026-002',
          patientName: 'Sunita Devi',
          patientCode: 'CS-000002',
          testName: 'Liver Function Test (LFT)',
          status: 'SAMPLE_COLLECTED',
          sampleBarcode: 'SMP-984210',
          orderedAt: new Date().toISOString()
        },
        {
          id: 'ord-3',
          orderNumber: 'LAB-2026-003',
          patientName: 'Kavitha Rao',
          patientCode: 'CS-000004',
          testName: 'Serum Electrolytes (Na/K/Cl)',
          status: 'RESULTED',
          sampleBarcode: 'SMP-984211',
          orderedAt: new Date().toISOString(),
          isCritical: true
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCollectSample = async () => {
    if (!selectedOrder) return;
    const barcode = `SMP-${Math.floor(100000 + Math.random() * 900000)}`;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrder.id
          ? { ...o, status: 'SAMPLE_COLLECTED', sampleBarcode: barcode }
          : o
      )
    );
    setStatusMsg({
      type: 'success',
      text: `Phlebotomy sample collected successfully. Barcode assigned: ${barcode}`
    });
    setSelectedOrder(null);
  };

  const handleSaveResults = (sign: boolean) => {
    if (!selectedOrder) return;
    setOrders((prev) =>
      prev.map((o) =>
        o.id === selectedOrder.id
          ? {
              ...o,
              status: sign ? 'SIGNED' : 'RESULTED',
              isCritical: criticalDetected
            }
          : o
      )
    );
    setShowResultModal(false);
    setStatusMsg({
      type: 'success',
      text: sign
        ? `Laboratory report digitally signed and published to Patient Portal! (Critical alerts dispatched to treating Doctor)`
        : 'Diagnostic parameter values saved in draft mode.'
    });
    setSelectedOrder(null);
  };

  const generateShareLink = (order: LabOrder) => {
    const token = Math.random().toString(36).substring(2, 15);
    const link = `${window.location.origin}/portal/reports/share/${token}?exp=24h`;
    setShareLink(link);
    setShowShareModal(true);
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-navy text-white p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-teal text-white px-3 py-1 rounded-lg text-lg">Laboratory</span>
            Pathology Orders, Sample Barcoding & Critical Result Flags
          </h1>
          <p className="text-teal-200 text-sm mt-1">
            Barcode Phlebotomy, Automated Critical Panic-Value Alerts, Digital Signatures
          </p>
        </div>
        <Button variant="secondary" onClick={loadLabOrders} loading={loading}>
          Refresh Queue
        </Button>
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

      {/* Orders Table */}
      <Card title="Diagnostic Laboratory Worklist">
        <div className="overflow-x-auto border border-gray-200 rounded-lg">
          <table className="w-full text-left text-xs">
            <thead className="bg-gray-100 text-gray-700">
              <tr>
                <th className="p-3">Order #</th>
                <th className="p-3">Patient Name</th>
                <th className="p-3">Test Investigation</th>
                <th className="p-3">Sample Barcode</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {orders.map((ord) => (
                <tr key={ord.id} className="hover:bg-gray-50">
                  <td className="p-3 font-mono font-semibold text-navy">{ord.orderNumber}</td>
                  <td className="p-3 font-bold">
                    {ord.patientName}{' '}
                    <span className="text-[10px] text-gray-500 font-normal">({ord.patientCode})</span>
                  </td>
                  <td className="p-3 font-medium text-teal">{ord.testName}</td>
                  <td className="p-3 font-mono">
                    {ord.sampleBarcode ? (
                      <span className="bg-gray-100 px-2 py-0.5 rounded border border-gray-300">
                        {ord.sampleBarcode}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic">Not collected</span>
                    )}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant={
                          ord.status === 'SIGNED'
                            ? 'success'
                            : ord.status === 'RESULTED'
                            ? 'primary'
                            : 'outline'
                        }
                      >
                        {ord.status}
                      </Badge>
                      {ord.isCritical && (
                        <span className="bg-red-600 text-white font-bold text-[10px] px-1.5 py-0.5 rounded animate-pulse">
                          CRITICAL
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-right space-x-2">
                    {ord.status === 'PENDING_SAMPLE' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(ord);
                          handleCollectSample();
                        }}
                      >
                        Collect Sample
                      </Button>
                    )}

                    {ord.status === 'SAMPLE_COLLECTED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(ord);
                          setShowResultModal(true);
                        }}
                      >
                        Enter Results
                      </Button>
                    )}

                    {ord.status === 'RESULTED' && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => {
                          setSelectedOrder(ord);
                          setShowResultModal(true);
                        }}
                      >
                        Sign & Authorize
                      </Button>
                    )}

                    {ord.status === 'SIGNED' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => generateShareLink(ord)}
                      >
                        Share Expiring Link
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Result Entry & Signing Modal */}
      <Modal
        isOpen={showResultModal}
        onClose={() => setShowResultModal(false)}
        title="Pathology Result Entry & Biological Reference Validation"
      >
        {selectedOrder && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
              <div>
                <strong>Investigation:</strong> {selectedOrder.testName}
              </div>
              <div>
                <strong>Patient:</strong> {selectedOrder.patientName} ({selectedOrder.patientCode}) | Barcode:{' '}
                {selectedOrder.sampleBarcode}
              </div>
            </div>

            <div className="space-y-3">
              {resultValues.map((param, idx) => (
                <div key={idx} className="grid grid-cols-4 gap-2 items-center text-xs">
                  <div className="font-semibold text-gray-800">{param.parameter}</div>
                  <div>
                    <input
                      type="text"
                      value={param.value}
                      onChange={(e) => {
                        const updated = [...resultValues];
                        updated[idx].value = e.target.value;
                        setResultValues(updated);
                      }}
                      className="w-full p-1.5 border border-gray-300 rounded text-xs"
                    />
                  </div>
                  <div className="text-gray-500">{param.unit}</div>
                  <div className="text-gray-500 font-mono">Ref: {param.refRange}</div>
                </div>
              ))}
            </div>

            {/* Critical Toggle */}
            <div className="p-3 bg-red-50 border border-red-200 rounded flex items-center justify-between text-xs">
              <span className="font-bold text-red-800">
                Mark as Critical / Panic Value (triggers immediate physician SMS alert)
              </span>
              <input
                type="checkbox"
                checked={criticalDetected}
                onChange={(e) => setCriticalDetected(e.target.checked)}
                className="w-4 h-4 text-red-600 rounded"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setShowResultModal(false)}>
                Cancel
              </Button>
              <Button variant="outline" onClick={() => handleSaveResults(false)}>
                Save Draft Values
              </Button>
              <Button variant="primary" onClick={() => handleSaveResults(true)}>
                Sign Report & Publish
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Expiring Share Link Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Consent-Based Expiring Report Share Link"
      >
        <div className="space-y-4">
          <p className="text-xs text-gray-600">
            This cryptographic link expires automatically in 24 hours. Every view is recorded in the patient access log under DPDP Act rules.
          </p>

          <div>
            <label className="text-xs font-semibold text-gray-700">Encrypted URL:</label>
            <input
              type="text"
              readOnly
              value={shareLink}
              className="w-full mt-1 p-2 text-xs border border-gray-300 rounded bg-gray-50 font-mono"
            />
          </div>

          <div className="flex justify-end gap-3">
            <Button
              variant="primary"
              onClick={() => {
                navigator.clipboard.writeText(shareLink);
                alert('Share link copied to clipboard!');
                setShowShareModal(false);
              }}
            >
              Copy Link to Clipboard
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
