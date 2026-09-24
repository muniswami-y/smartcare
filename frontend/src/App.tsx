import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { StaffLoginPage } from './features/auth/StaffLoginPage';
import { PatientLoginPage } from './features/auth/PatientLoginPage';
import { ReceptionDashboard } from './features/reception/ReceptionDashboard';
import { DoctorConsultationPage } from './features/doctor/DoctorConsultationPage';
import { NurseVitalsPage } from './features/nurse/NurseVitalsPage';
import { PharmacyPage } from './features/pharmacy/PharmacyPage';
import { LabImagingPage } from './features/lab/LabImagingPage';
import { RadiologyPage } from './features/radiology/RadiologyPage';
import { BillingCounterPage } from './features/billing/BillingCounterPage';
import { IpdBedBoardPage } from './features/ipd/IpdBedBoardPage';
import { PatientPortalPage } from './features/patient-portal/PatientPortalPage';
import { AdminDashboard } from './features/admin/AdminDashboard';
import { PublicPriceListPage } from './features/prices/PublicPriceListPage';

const Header: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const [currentUser, setCurrentUser] = useState<{
    fullName: string;
    roles: string[];
    isPatient?: boolean;
  } | null>(null);

  useEffect(() => {
    const userStr = localStorage.getItem('cs_user');
    if (userStr) {
      try {
        setCurrentUser(JSON.parse(userStr));
      } catch {
        setCurrentUser(null);
      }
    } else {
      setCurrentUser(null);
    }
  }, [location.pathname]);

  const handleLogout = () => {
    localStorage.removeItem('cs_token');
    localStorage.removeItem('cs_user');
    setCurrentUser(null);
    navigate('/login');
  };

  const changeLanguage = (lang: string) => {
    i18n.changeLanguage(lang);
  };

  return (
    <header className="bg-navy text-white sticky top-0 z-50 shadow-md">
      {/* Emergency Strip */}
      <div className="bg-navy-800 text-[11px] py-1 px-4 flex justify-between items-center text-teal-200 border-b border-teal-900/50">
        <span>🚑 {t('app.emergency', 'Emergency 24/7 Helpline: 108 / +91 40 2345 6789')}</span>
        <div className="flex items-center gap-3">
          <span>NABH Accredited Tertiary Center</span>
          <div className="flex gap-1.5 font-bold">
            <button
              onClick={() => changeLanguage('en')}
              className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
                i18n.language === 'en' ? 'bg-teal text-white' : 'hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              onClick={() => changeLanguage('te')}
              className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
                i18n.language === 'te' ? 'bg-teal text-white' : 'hover:text-white'
              }`}
            >
              తెలుగు
            </button>
            <button
              onClick={() => changeLanguage('hi')}
              className={`px-1.5 py-0.5 rounded text-xs transition-colors ${
                i18n.language === 'hi' ? 'bg-teal text-white' : 'hover:text-white'
              }`}
            >
              हिन्दी
            </button>
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal rounded-lg flex items-center justify-center font-black text-xl text-white shadow-inner">
            CS
          </div>
          <div>
            <div className="font-extrabold text-lg tracking-tight leading-none text-white">
              CareSmart
            </div>
            <div className="text-[10px] text-teal-300 tracking-wider uppercase font-semibold">
              Hospital Management
            </div>
          </div>
        </Link>

        {/* Navigation Links */}
        <nav className="hidden md:flex items-center gap-1 text-xs font-semibold">
          <Link
            to="/prices"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/prices' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.publicPrices', 'Price Transparency')}
          </Link>
          <Link
            to="/reception"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/reception' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.reception', 'Reception & OPD')}
          </Link>
          <Link
            to="/doctor"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/doctor' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.doctor', 'Doctor Consult')}
          </Link>
          <Link
            to="/nurse"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/nurse' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.nurse', 'Nurse Vitals')}
          </Link>
          <Link
            to="/pharmacy"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/pharmacy' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.pharmacy', 'Pharmacy')}
          </Link>
          <Link
            to="/lab"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/lab' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.lab', 'Lab')}
          </Link>
          <Link
            to="/radiology"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/radiology' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.imaging', 'Radiology')}
          </Link>
          <Link
            to="/billing"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/billing' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.billing', 'Billing')}
          </Link>
          <Link
            to="/ipd"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/ipd' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.ipd', 'IPD Beds')}
          </Link>
          <Link
            to="/portal"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/portal' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.portal', 'Patient Portal')}
          </Link>
          <Link
            to="/admin"
            className={`px-2.5 py-1.5 rounded-md transition-colors ${
              location.pathname === '/admin' ? 'bg-teal text-white' : 'hover:bg-navy-800 text-gray-200'
            }`}
          >
            {t('nav.admin', 'Admin')}
          </Link>
        </nav>

        {/* User Auth controls */}
        <div className="flex items-center gap-2">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-xs font-bold leading-none">{currentUser.fullName}</div>
                <div className="text-[10px] text-teal-300">
                  {currentUser.roles?.join(', ') || 'STAFF'}
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="bg-navy-800 hover:bg-red-900 border border-teal-800 px-3 py-1 rounded text-xs transition-colors"
              >
                {t('nav.logout', 'Logout')}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                to="/patient/login"
                className="text-xs font-semibold text-teal-300 hover:text-white px-2 py-1"
              >
                Patient OTP Login
              </Link>
              <Link
                to="/login"
                className="bg-teal hover:bg-teal-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg transition-colors shadow-sm"
              >
                Staff Login
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <Header />
        <main className="flex-1">
          <Routes>
            <Route path="/" element={<PublicPriceListPage />} />
            <Route path="/prices" element={<PublicPriceListPage />} />
            <Route path="/login" element={<StaffLoginPage />} />
            <Route path="/patient/login" element={<PatientLoginPage />} />
            <Route path="/reception" element={<ReceptionDashboard />} />
            <Route path="/doctor" element={<DoctorConsultationPage />} />
            <Route path="/nurse" element={<NurseVitalsPage />} />
            <Route path="/pharmacy" element={<PharmacyPage />} />
            <Route path="/lab" element={<LabImagingPage />} />
            <Route path="/radiology" element={<RadiologyPage />} />
            <Route path="/billing" element={<BillingCounterPage />} />
            <Route path="/ipd" element={<IpdBedBoardPage />} />
            <Route path="/portal" element={<PatientPortalPage />} />
            <Route path="/patient" element={<PatientPortalPage />} />
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="*" element={<PublicPriceListPage />} />
          </Routes>
        </main>
        <footer className="bg-navy text-gray-400 py-6 text-center text-xs border-t border-teal-900/50">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-2">
            <div>
              © 2026 CareSmart Multispeciality Hospital • Transparent, Paperless Healthcare
            </div>
            <div>
              India DPDP Act 2023 Compliant • SHA-256 Hash Chain Validated Medical Records
            </div>
          </div>
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
