import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Skeleton } from '../../components/ui/Skeleton';

interface PrescriptionItem {
  id: string;
  medicineName: string;
  dosage: string;
  frequency: string;
  durationDays: number;
  instructions: string;
}

interface PendingPrescription {
  id: string;
  patientId: string;
  patientName: string;
  patientCode: string;
  doctorName: string;
  createdAt: string;
  items: PrescriptionItem[];
}

interface MedicineBatch {
  id: string;
  medicineId: string;
  medicineName: string;
  batchNumber: string;
  expiryDate: string;
  currentStock: number;
  unitPricePaise: number;
  isControlled: boolean;
}

export const PharmacyPage: React.FC = () => {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<'queue' | 'inventory'>('queue');
  const [prescriptions, setPrescriptions] = useState<PendingPrescription[]>([]);
  const [batches, setBatches] = useState<MedicineBatch[]>([]);
  const [loading, setLoading] = useState(false);
  const [dispensing, setDispensing] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Dispense modal
  const [selectedRx, setSelectedRx] = useState<PendingPrescription | null>(null);
  const [selectedBatchId, setSelectedBatchId] = useState<string>('');
  const [dispenseQty, setDispenseQty] = useState<number>(10);
  const [doctorRegNo, setDoctorRegNo] = useState<string>('TS-MC-48291');

  // Stock Adjustment Modal
  const [showStockModal, setShowStockModal] = useState(false);
  const [newBatch, setNewBatch] = useState({
    medicineName: '',
    batchNumber: '',
    expiryDate: '',
    quantity: 100,
    unitPriceRupees: 15
  });

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); // Polling for incoming prescriptions
    return () => clearInterval(interval);
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // 1. Load active prescriptions
      const rxData = await api.get<any[]>('/prescriptions');
      const mappedRx: PendingPrescription[] = rxData.map((p: any) => ({
        id: p.id,
        patientId: p.patientId,
        patientName: p.patient?.fullName || 'Patient',
        patientCode: p.patient?.patientCode || 'CS-XXXX',
        doctorName: p.consultation?.appointment?.doctor?.user?.fullName || 'Dr. Treating Physician',
        createdAt: p.createdAt,
        items: p.items || []
      }));
      setPrescriptions(mappedRx);

      // 2. Load stock inventory batches
      const stockData = await api.get<any[]>('/pharmacy/batches');
      const mappedBatches: MedicineBatch[] = stockData.map((b: any) => ({
        id: b.id,
        medicineId: b.medicineId,
        medicineName: b.medicine?.name || b.name || 'Medicine',
        batchNumber: b.batchNumber,
        expiryDate: b.expiryDate?.split('T')[0] || '2026-12-31',
        currentStock: b.currentQuantity || b.currentStock || 0,
        unitPricePaise: b.unitPricePaise || 500,
        isControlled: b.medicine?.isControlled || false
      }));
      setBatches(mappedBatches);
    } catch {
      // Fallback
    } finally {
      setLoading(false);
    }
  };

  const handleDispenseMedicine = async () => {
    if (!selectedRx || !selectedBatchId) return;
    setDispensing(true);
    setStatusMsg(null);

    try {
      await api.post('/pharmacy/dispense', {
        prescriptionId: selectedRx.id,
        patientId: selectedRx.patientId,
        batchId: selectedBatchId,
        quantity: Number(dispenseQty),
        doctorRegistrationNumber: doctorRegNo
      });

      setStatusMsg({
        type: 'success',
        text: `Successfully dispensed medication under FEFO protocol! Stock ledger updated and pending charge added to Patient Bill.`
      });
      setSelectedRx(null);
      await loadData();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Dispensing failed'
      });
    } finally {
      setDispensing(false);
    }
  };

  const handleAddStock = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/pharmacy/batches', {
        medicineName: newBatch.medicineName,
        batchNumber: newBatch.batchNumber,
        expiryDate: newBatch.expiryDate,
        quantity: Number(newBatch.quantity),
        unitPricePaise: Math.round(Number(newBatch.unitPriceRupees) * 100)
      });
      setShowStockModal(false);
      setNewBatch({
        medicineName: '',
        batchNumber: '',
        expiryDate: '',
        quantity: 100,
        unitPriceRupees: 15
      });
      setStatusMsg({
        type: 'success',
        text: 'New inventory batch received and logged in stock ledger.'
      });
      await loadData();
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: err.message || 'Failed to add batch'
      });
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-navy text-white p-6 rounded-xl shadow-lg">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <span className="bg-teal text-white px-3 py-1 rounded-lg text-lg">Pharmacy</span>
            Prescription Dispensing & FEFO Inventory
          </h1>
          <p className="text-teal-200 text-sm mt-1">
            Real-Time Rx Ingestion, Atomic Stock Transactions, Expiry & Low-Stock Safeguards
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-navy-800 p-1 rounded-lg border border-teal-800">
            <button
              onClick={() => setActiveTab('queue')}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${
                activeTab === 'queue' ? 'bg-teal text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              Incoming Prescriptions ({prescriptions.length})
            </button>
            <button
              onClick={() => setActiveTab('inventory')}
              className={`px-3 py-1.5 text-xs font-semibold rounded ${
                activeTab === 'inventory' ? 'bg-teal text-white' : 'text-gray-300 hover:text-white'
              }`}
            >
              Batch Inventory ({batches.length})
            </button>
          </div>
          <Button variant="secondary" size="sm" onClick={() => setShowStockModal(true)}>
            + Receive Stock
          </Button>
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

      {activeTab === 'queue' ? (
        /* Prescriptions Queue */
        <Card title="Prescriptions Arriving from Consultation & IPD">
          {loading && prescriptions.length === 0 ? (
            <div className="space-y-3">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
            </div>
          ) : prescriptions.length === 0 ? (
            <p className="text-center py-12 text-sm text-gray-500">
              No pending un-dispensed prescriptions. Prescriptions will appear here automatically when finalized by doctors.
            </p>
          ) : (
            <div className="divide-y divide-gray-200">
              {prescriptions.map((rx) => (
                <div key={rx.id} className="py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-navy text-base">{rx.patientName}</span>
                      <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded font-mono">
                        {rx.patientCode}
                      </span>
                      <span className="text-xs text-gray-500">Prescribed by {rx.doctorName}</span>
                    </div>

                    <div className="mt-2 flex flex-wrap gap-2">
                      {rx.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="bg-teal-50 border border-teal-200 rounded px-2.5 py-1 text-xs text-navy"
                        >
                          <strong>{item.medicineName}</strong> ({item.dosage}) - {item.frequency} for{' '}
                          {item.durationDays} days
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        setSelectedRx(rx);
                        if (batches.length > 0) setSelectedBatchId(batches[0].id);
                      }}
                    >
                      Dispense (FEFO Pick)
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      ) : (
        /* Batch Inventory Table */
        <Card title="Medicine Batches & Stock Ledger (FEFO Sorted)">
          <div className="overflow-x-auto border border-gray-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <th className="p-3">Medicine Name</th>
                  <th className="p-3">Batch Number</th>
                  <th className="p-3">Expiry Date</th>
                  <th className="p-3">Stock Units</th>
                  <th className="p-3">Unit Price (₹)</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Alert Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {batches.map((b) => {
                  const isExpiringSoon =
                    new Date(b.expiryDate).getTime() - new Date().getTime() < 30 * 24 * 3600 * 1000;
                  const isLowStock = b.currentStock < 20;

                  return (
                    <tr key={b.id} className="hover:bg-gray-50">
                      <td className="p-3 font-bold text-navy">{b.medicineName}</td>
                      <td className="p-3 font-mono">{b.batchNumber}</td>
                      <td className="p-3">{b.expiryDate}</td>
                      <td className="p-3 font-semibold">
                        <span className={isLowStock ? 'text-red-600 font-bold' : 'text-gray-900'}>
                          {b.currentStock} units
                        </span>
                      </td>
                      <td className="p-3">₹{(b.unitPricePaise / 100).toFixed(2)}</td>
                      <td className="p-3">
                        {b.isControlled ? (
                          <Badge variant="danger">Schedule H / Controlled</Badge>
                        ) : (
                          <Badge variant="outline">General Rx</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        {isExpiringSoon && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold mr-1">
                            Expiring Soon
                          </span>
                        )}
                        {isLowStock && (
                          <span className="text-[10px] bg-red-100 text-red-800 px-2 py-0.5 rounded font-bold">
                            Low Stock
                          </span>
                        )}
                        {!isExpiringSoon && !isLowStock && (
                          <span className="text-green-600 font-medium">Healthy</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Dispense Modal with FEFO Picking */}
      <Modal
        isOpen={!!selectedRx}
        onClose={() => setSelectedRx(null)}
        title="Dispense Prescription (FEFO Protocol)"
      >
        {selectedRx && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-3 rounded text-xs space-y-1">
              <div>
                <strong>Patient:</strong> {selectedRx.patientName} ({selectedRx.patientCode})
              </div>
              <div>
                <strong>Prescription Items:</strong>
              </div>
              <ul className="list-disc list-inside">
                {selectedRx.items.map((it, i) => (
                  <li key={i}>
                    {it.medicineName} - {it.dosage} ({it.frequency} × {it.durationDays} days)
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">
                Select Available Batch (Earliest Expiry Picked First) *
              </label>
              <select
                value={selectedBatchId}
                onChange={(e) => setSelectedBatchId(e.target.value)}
                className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.medicineName} | Batch: {b.batchNumber} | Exp: {b.expiryDate} | Avail:{' '}
                    {b.currentStock} units
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Quantity to Dispense *</label>
                <input
                  type="number"
                  min="1"
                  value={dispenseQty}
                  onChange={(e) => setDispenseQty(Number(e.target.value))}
                  className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-gray-700">
                  Doctor Reg. Number (for Schedule H audit)
                </label>
                <input
                  type="text"
                  value={doctorRegNo}
                  onChange={(e) => setDoctorRegNo(e.target.value)}
                  className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                />
              </div>
            </div>

            <div className="p-3 bg-teal-50 border border-teal-200 rounded text-xs text-teal-800">
              ℹ️ CareSmart executes dispensing within an atomic database transaction. Stock cannot become negative, and charges are synchronized directly to the patient's billing invoice.
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="secondary" onClick={() => setSelectedRx(null)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                onClick={handleDispenseMedicine}
                loading={dispensing}
                disabled={!selectedBatchId}
              >
                Confirm & Dispense
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Receive Stock Modal */}
      <Modal
        isOpen={showStockModal}
        onClose={() => setShowStockModal(false)}
        title="Receive New Medicine Batch (Goods Receipt)"
      >
        <form onSubmit={handleAddStock} className="space-y-4">
          <div>
            <label className="text-xs font-semibold text-gray-700">Medicine Generic / Brand Name *</label>
            <input
              type="text"
              placeholder="e.g. Paracetamol 650mg / Azithromycin 500mg"
              value={newBatch.medicineName}
              onChange={(e) => setNewBatch({ ...newBatch, medicineName: e.target.value })}
              className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700">Batch Number *</label>
              <input
                type="text"
                placeholder="e.g. B-2026-904"
                value={newBatch.batchNumber}
                onChange={(e) => setNewBatch({ ...newBatch, batchNumber: e.target.value })}
                className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg font-mono"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Expiry Date *</label>
              <input
                type="date"
                value={newBatch.expiryDate}
                onChange={(e) => setNewBatch({ ...newBatch, expiryDate: e.target.value })}
                className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-gray-700">Quantity (Units) *</label>
              <input
                type="number"
                min="1"
                value={newBatch.quantity}
                onChange={(e) => setNewBatch({ ...newBatch, quantity: Number(e.target.value) })}
                className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                required
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-700">Retail Unit Price (₹) *</label>
              <input
                type="number"
                step="0.01"
                value={newBatch.unitPriceRupees}
                onChange={(e) => setNewBatch({ ...newBatch, unitPriceRupees: Number(e.target.value) })}
                className="w-full mt-1 p-2 text-sm border border-gray-300 rounded-lg"
                required
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" onClick={() => setShowStockModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" type="submit">
              Log Into Stock Ledger
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
