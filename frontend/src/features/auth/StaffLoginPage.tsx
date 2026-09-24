import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api, ApiError } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { ShieldCheck, Lock, Mail, Key } from 'lucide-react';

export const StaffLoginPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('reception@caresmart.demo');
  const [password, setPassword] = useState('Password123!');
  const [totpToken, setTotpToken] = useState('');
  const [requiresTotp, setRequiresTotp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const data = await api.post('/auth/staff/login', {
        email,
        password,
        totpToken: requiresTotp ? totpToken : undefined
      });

      if (data.requiresTotp) {
        setRequiresTotp(true);
        setLoading(false);
        return;
      }

      localStorage.setItem('cs_token', data.accessToken);
      localStorage.setItem('cs_user', JSON.stringify(data.user));

      // Redirect by role
      const roles: string[] = data.user.roles || [];
      if (roles.includes('ADMIN') || roles.includes('MANAGER')) navigate('/admin');
      else if (roles.includes('DOCTOR')) navigate('/doctor');
      else if (roles.includes('NURSE')) navigate('/nurse');
      else if (roles.includes('PHARMACIST')) navigate('/pharmacy');
      else if (roles.includes('LAB_TECH')) navigate('/lab');
      else if (roles.includes('RADIOLOGIST')) navigate('/imaging');
      else navigate('/reception');
    } catch (err: any) {
      setError(err?.message || 'Login failed. Please check your server connection and credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoRole = (roleUser: string, rolePass: string = 'Password123!') => {
    setEmail(roleUser);
    setPassword(rolePass);
    setRequiresTotp(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex p-3 bg-brand-teal/20 text-brand-mint rounded-2xl mb-3 border border-brand-teal/30">
            <ShieldCheck className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight">{t('app.name')}</h1>
          <p className="text-sm text-slate-400 mt-1">{t('auth.staffLoginTitle')}</p>
        </div>

        <Card className="bg-slate-800/90 border-slate-700 text-white backdrop-blur shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3 text-xs bg-rose-500/20 border border-rose-500/40 text-rose-300 rounded-lg">
                {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t('auth.email')} / Username</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="text"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal"
                  placeholder="smartcare or staff@caresmart.demo"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">{t('auth.password')}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-900/80 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-brand-teal"
                />
              </div>
            </div>

            {requiresTotp && (
              <div>
                <label className="block text-xs font-medium text-brand-mint mb-1">Two-Factor Authentication (TOTP)</label>
                <div className="relative">
                  <Key className="w-4 h-4 text-brand-mint absolute left-3 top-3" />
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={totpToken}
                    onChange={(e) => setTotpToken(e.target.value)}
                    className="w-full bg-slate-900/80 border border-brand-teal rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-slate-500 focus:outline-none"
                    placeholder="Enter 6-digit authenticator code"
                  />
                </div>
              </div>
            )}

            <Button type="submit" isLoading={loading} className="w-full bg-brand-teal hover:bg-brand-teal/90 text-white font-medium py-2.5">
              {t('auth.login')}
            </Button>
          </form>

          {/* Quick Demo Role Selector */}
          <div className="mt-6 pt-4 border-t border-slate-700/80">
            <p className="text-xs text-slate-400 font-medium mb-2 text-center">Fast Demo Role Switcher:</p>
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <button onClick={() => setDemoRole('reception@caresmart.demo')} className="p-1.5 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-300 text-left">
                Receptionist / Cashier
              </button>
              <button onClick={() => setDemoRole('dr.sharma@caresmart.demo')} className="p-1.5 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-300 text-left">
                Doctor (Medicine)
              </button>
              <button onClick={() => setDemoRole('nurse.lakshmi@caresmart.demo')} className="p-1.5 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-300 text-left">
                Nurse (Vitals/Wards)
              </button>
              <button onClick={() => setDemoRole('pharmacist.ravi@caresmart.demo')} className="p-1.5 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-300 text-left">
                Pharmacist
              </button>
              <button onClick={() => setDemoRole('lab.suresh@caresmart.demo')} className="p-1.5 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-300 text-left">
                Lab Senior Tech
              </button>
              <button onClick={() => setDemoRole('radiologist.anita@caresmart.demo')} className="p-1.5 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-300 text-left">
                Radiologist
              </button>
              <button onClick={() => setDemoRole('smartcare', 'smartcare')} className="p-1.5 bg-brand-teal/20 hover:bg-brand-teal/30 border border-brand-teal/40 rounded text-brand-mint font-medium text-left">
                Admin (smartcare / smartcare)
              </button>
              <button onClick={() => setDemoRole('manager.kavitha@caresmart.demo')} className="p-1.5 bg-slate-900/60 hover:bg-slate-700 rounded text-slate-300 text-left">
                Manager (Aggregates)
              </button>
            </div>
          </div>
        </Card>

        <div className="mt-4 text-center">
          <button
            onClick={() => navigate('/patient/login')}
            className="text-xs text-brand-light-teal hover:underline"
          >
            Are you a patient? Go to Patient & Family OTP Portal &rarr;
          </button>
        </div>
      </div>
    </div>
  );
};
