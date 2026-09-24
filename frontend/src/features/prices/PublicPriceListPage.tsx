import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

interface ServicePriceItem {
  id: string;
  category: 'OPD' | 'LAB' | 'RADIOLOGY' | 'IPD' | 'PROCEDURE';
  code: string;
  name: string;
  description: string;
  priceRupees: number;
  preparation?: string;
  turnaroundTime?: string;
}

const publicPriceCatalog: ServicePriceItem[] = [
  // OPD
  {
    id: 'pr-1',
    category: 'OPD',
    code: 'OPD-GEN',
    name: 'General Physician Consultation',
    description: 'First OPD evaluation, vitals triage, medical history & electronic prescription',
    priceRupees: 500
  },
  {
    id: 'pr-2',
    category: 'OPD',
    code: 'OPD-SPEC',
    name: 'Specialist / Super-Specialist Consultation',
    description: 'Cardiology, Neurology, Orthopedics, Pulmonology specialist review',
    priceRupees: 800
  },

  // LAB
  {
    id: 'pr-3',
    category: 'LAB',
    code: 'LAB-CBC',
    name: 'Complete Blood Count (CBC) Automated',
    description: 'Hemoglobin, RBC, Total & Differential WBC, Platelets, MCV, MCH, MCHC',
    priceRupees: 400,
    preparation: 'No special fasting required',
    turnaroundTime: '2 hours'
  },
  {
    id: 'pr-4',
    category: 'LAB',
    code: 'LAB-LFT',
    name: 'Liver Function Test (LFT Complete)',
    description: 'Bilirubin Total/Direct, SGOT, SGPT, Alkaline Phosphatase, Total Protein, Albumin',
    priceRupees: 850,
    preparation: 'Overnight fasting (8-10 hours) recommended',
    turnaroundTime: '4 hours'
  },
  {
    id: 'pr-5',
    category: 'LAB',
    code: 'LAB-KFT',
    name: 'Kidney Function Test (KFT / RFT)',
    description: 'Blood Urea, Serum Creatinine, Uric Acid, BUN',
    priceRupees: 650,
    preparation: 'No fasting required',
    turnaroundTime: '3 hours'
  },
  {
    id: 'pr-6',
    category: 'LAB',
    code: 'LAB-LIPID',
    name: 'Lipid Profile Comprehensive',
    description: 'Total Cholesterol, Triglycerides, HDL, LDL, VLDL, TC/HDL Ratio',
    priceRupees: 750,
    preparation: 'Strict 12-hour fasting mandatory',
    turnaroundTime: '4 hours'
  },

  // RADIOLOGY
  {
    id: 'pr-7',
    category: 'RADIOLOGY',
    code: 'RAD-CXR',
    name: 'Digital Chest X-Ray (PA View)',
    description: 'High-definition digital DR radiograph with certified Radiologist report',
    priceRupees: 600,
    preparation: 'Remove metallic necklaces or jewelry',
    turnaroundTime: '1 hour'
  },
  {
    id: 'pr-8',
    category: 'RADIOLOGY',
    code: 'RAD-USG-ABD',
    name: 'Ultrasound Whole Abdomen & Pelvis',
    description: 'Real-time color Doppler ultrasonography by Senior Radiologist',
    priceRupees: 1400,
    preparation: 'Drink 1 liter water 1 hour prior for full bladder',
    turnaroundTime: '2 hours'
  },
  {
    id: 'pr-9',
    category: 'RADIOLOGY',
    code: 'RAD-CT-BRAIN',
    name: 'NCCT Brain (Non-Contrast Computed Tomography)',
    description: '128-Slice multi-detector CT brain scan with 3D reconstruction',
    priceRupees: 2800,
    preparation: 'Fast for 2 hours if contrast may be required',
    turnaroundTime: '3 hours'
  },

  // IPD WARDS
  {
    id: 'pr-10',
    category: 'IPD',
    code: 'IPD-GEN-BED',
    name: 'General Multi-Bed Ward (Per Day)',
    description: 'Includes nursing care, biometric vitals monitoring, resident doctor coverage',
    priceRupees: 1500
  },
  {
    id: 'pr-11',
    category: 'IPD',
    code: 'IPD-PVT-BED',
    name: 'Single Private Deluxe Room (Per Day)',
    description: 'Air-conditioned private room with attendant cot, TV, attached washroom',
    priceRupees: 4500
  },
  {
    id: 'pr-12',
    category: 'IPD',
    code: 'IPD-ICU-BED',
    name: 'Intensive Care Unit (ICU / ICCU Bed Per Day)',
    description: '1:1 Nurse-patient ratio, advanced multipara ventilator monitoring, intensivist care',
    priceRupees: 6500
  }
];

export const PublicPriceListPage: React.FC = () => {
  const { t } = useTranslation();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredItems = publicPriceCatalog.filter((item) => {
    const matchesCategory =
      selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesSearch =
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Top Banner */}
      <div className="bg-navy text-white p-8 rounded-2xl shadow-lg relative overflow-hidden">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-block bg-teal text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
            100% Price Transparency Policy
          </div>
          <h1 className="text-3xl font-extrabold">Public Medical Services Tariff & Price List</h1>
          <p className="text-teal-200 text-sm mt-2">
            CareSmart Hospital operates under absolute pricing transparency. All charges are published with no hidden fees or surprise billings.
          </p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Category Buttons */}
        <div className="flex flex-wrap gap-2">
          {['ALL', 'OPD', 'LAB', 'RADIOLOGY', 'IPD'].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                selectedCategory === cat
                  ? 'bg-teal text-white shadow-sm'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              {cat === 'ALL'
                ? 'All Services'
                : cat === 'OPD'
                ? 'OPD Consults'
                : cat === 'LAB'
                ? 'Pathology Lab'
                : cat === 'RADIOLOGY'
                ? 'X-Ray & Scans'
                : 'Inpatient Beds'}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="w-full md:w-72">
          <input
            type="text"
            placeholder="Search test, procedure, or code..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-xs border border-gray-300 rounded-lg focus:ring-1 focus:ring-teal"
          />
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredItems.map((item) => (
          <Card key={item.id}>
            <div className="flex flex-col justify-between h-full space-y-4">
              <div>
                <div className="flex items-start justify-between">
                  <Badge variant={item.category === 'LAB' ? 'primary' : 'success'}>
                    {item.category}
                  </Badge>
                  <span className="font-mono text-xs text-gray-400 font-semibold">{item.code}</span>
                </div>

                <h3 className="font-bold text-base text-navy mt-2">{item.name}</h3>
                <p className="text-xs text-gray-600 mt-1">{item.description}</p>

                {(item.preparation || item.turnaroundTime) && (
                  <div className="mt-3 p-2.5 bg-gray-50 rounded text-[11px] space-y-1 border border-gray-100">
                    {item.preparation && (
                      <div>
                        <strong>Instructions:</strong> {item.preparation}
                      </div>
                    )}
                    {item.turnaroundTime && (
                      <div className="text-teal font-medium">
                        <strong>Turnaround Time:</strong> ~{item.turnaroundTime}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                <span className="text-xs text-gray-500">Government & NabH Compliant</span>
                <span className="text-xl font-extrabold text-teal">₹{item.priceRupees.toFixed(2)}</span>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <p className="text-gray-500 text-sm">No medical services match your search criteria.</p>
        </div>
      )}
    </div>
  );
};
