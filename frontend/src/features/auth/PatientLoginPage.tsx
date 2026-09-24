import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { HeartPulse, Phone, KeyRound, CheckSquare } from 'lucide-react';

export const PatientLoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [phone, setPhone] = useState('+919876543001');
  const [otp, setOtp] = useState('123456');
  const [step, setStep] = useState<'REQUEST' | 'VERIFY'>('REQUEST');
  const [isSharedDevice, setIsSharedDevice] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/auth/patient/otp/request', { phone });
      setMessage(data.message || 'OTP sent to mobile.');
      setStep('VERIFY');
      setOtp('123456'); // Pre-fill test OTP for demo ease
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Failed to request OTP. Try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const data = await api.post('/auth/patient/otp/verify', {
        phone,
        otp,
        isSharedDevice
      });

      localStorage.setItem('cs_token', data.accessToken);
      localStorage.setItem('cs_patient_account', JSON.stringify(data.account));
      navigate('/patient');
    } catch (err: any) {
      if (err instanceof ApiError) setError(err.message);
      else setError('Incorrect or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-brand-teal/20 text-brand-mint rounded-2xl mb-3 border border-brand-teal/30">
            <HeartPulse className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('app.name')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('auth.patientLoginTitle')}</p>
        </div>

        <Card className="bg-slate-800/90 border-slate-700 text-white backdrop-blur shadow-2xl">
          {error && (
            <div className="p-3 text-xs bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-lg mb-4">
              {error}
            </div>
          )}
          {message && (
            <div className="p-3 text-xs bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 rounded-lg mb-4">
              {message}
            </div>
          )}

          {step === 'REQUEST' ? (
            <form onSubmit={handleRequestOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('auth.mobileNumber')}</label>
                <div className="relative">
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-slate-900/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal"
                    placeholder="+919876543210"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1">
                  Enter registered 10-digit mobile number for instantaneous paperless access.
                </p>
              </div>

              <div className="flex items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  id="sharedDev"
                  checked={isSharedDevice}
                  onChange={(e) => setIsSharedDevice(e.target.checked)}
                  className="rounded border-slate-700 accent-brand-teal"
                />
                <label htmlFor="sharedDev" className="cursor-pointer">{t('auth.sharedDevice')}</label>
              </div>

              <Button type="submit" isLoading={loading} className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-medium py-2.5">
                {t('auth.requestOtp')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleVerifyOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">{t('auth.enterOtp')}</label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-brand-mint absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    className="w-full bg-slate-900/80 border border-brand-teal rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 font-mono tracking-widest text-center text-lg focus:outline-none"
                    placeholder="123456"
                  />
                </div>
                <p className="text-[11px] text-slate-400 mt-1 text-center">
                  (Demo OTP is set to <strong className="text-white">123456</strong> for testing)
                </p>
              </div>

              <Button type="submit" isLoading={loading} className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-medium py-2.5">
                {t('auth.verifyOtp')}
              </Button>

              <button
                type="button"
                onClick={() => setStep('REQUEST')}
                className="w-full text-xs text-slate-400 hover:text-white text-center block pt-2"
              >
                Change mobile number
              </button>
            </form>
          )}

          {/* Quick Demo Families */}
          <div className="mt-6 pt-4 border-t border-slate-700/80">
            <p className="text-xs text-slate-400 font-medium mb-2 text-center">Demo Patient Accounts:</p>
            <div className="space-y-1.5 text-xs">
              <button
                onClick={() => { setPhone('+919876543001'); setStep('REQUEST'); }}
                className="w-full p-2 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-200 text-left flex justify-between"
              >
                <span>Sharma Family (Aarav, Sita, Rohan)</span>
                <span className="text-brand-mint font-mono">+919876543001</span>
              </button>
              <button
                onClick={() => { setPhone('+919876543004'); setStep('REQUEST'); }}
                className="w-full p-2 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-200 text-left flex justify-between"
              >
                <span>Rao Family (Venkat & Padmavathi)</span>
                <span className="text-brand-mint font-mono">+919876543004</span>
              </button>
            </div>
          </div>
        </Card>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/login')}
            className="text-xs text-brand-light-teal hover:underline"
          >
            Are you hospital staff? Go to Staff Login &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
