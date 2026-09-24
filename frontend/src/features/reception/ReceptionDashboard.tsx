import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { api } from '../../api/client';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { TableSkeleton } from '../../components/ui/Skeleton';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatINR } from '../../lib/utils';
import {
  Users,
  Calendar,
  UserPlus,
  Search,
  CheckCircle,
  Clock,
  AlertTriangle,
  PlayCircle
} from 'lucide-react';

export const ReceptionDashboard: React.FC = () => {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<'REGISTER' | 'APPOINTMENTS' | 'QUEUE'>('APPOINTMENTS');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDoctorId, setSelectedDoctorId] = useState('all');
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isBookingOpen, setIsBookingOpen] = useState(false);

  // New Patient Form State
  const [regForm, setRegForm] = useState({
    fullName: '',
    gender: 'MALE',
    ageYears: 30,
    phone: '',
    email: '',
    address: '',
    bloodGroup: 'O+',
    emergencyContactName: '',
    emergencyContactPhone: '',
    isTemporaryEmergency: false
  });
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);

  // New Booking Form State
  const [bookForm, setBookForm] = useState({
    patientId: '',
    doctorId: '',
    departmentId: '',
    appointmentDate: new Date().toISOString().split('T')[0],
    slotStartTime: '09:00',
    slotEndTime: '09:15',
    isWalkIn: false
  });

  // Query Patients
  const { data: patients = [], isLoading: patientsLoading } = useQuery({
    queryKey: ['patients', searchQuery],
    queryFn: () => api.get(`/patients/search?q=${encodeURIComponent(searchQuery)}`)
  });

  // Query Appointments (Polling every 10 seconds for real-time queue synchronization)
  const { data: appointments = [], isLoading: apptsLoading } = useQuery({
    queryKey: ['appointments', selectedDoctorId],
    queryFn: () => api.get(`/appointments?date=${new Date().toISOString().split('T')[0]}`),
    refetchInterval: 10000
  });

  // Query Doctors
  const { data: staffList = [] } = useQuery({
    queryKey: ['staffList'],
    queryFn: () => api.get('/admin/staff')
  });

  const doctors = staffList.filter((s: any) => s.roles.some((r: any) => r.role === 'DOCTOR'));

  // Patient Registration Mutation
  const registerMutation = useMutation({
    mutationFn: (newPatient: any) => api.post('/patients', newPatient),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['patients'] });
      if (res.duplicateWarning) {
        setDuplicateWarning(res.duplicateWarning);
      } else {
        setIsRegisterOpen(false);
        setRegForm({
          fullName: '',
          gender: 'MALE',
          ageYears: 30,
          phone: '',
          email: '',
          address: '',
          bloodGroup: 'O+',
          emergencyContactName: '',
          emergencyContactPhone: '',
          isTemporaryEmergency: false
        });
      }
    }
  });

  // Booking Mutation
  const bookMutation = useMutation({
    mutationFn: (booking: any) => {
      if (booking.isWalkIn) {
        return api.post('/appointments/walk-in', {
          patientId: booking.patientId,
          doctorId: booking.doctorId,
          departmentId: booking.departmentId
        });
      }
      return api.post('/appointments', booking);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
      setIsBookingOpen(false);
    }
  });

  // Check-In Mutation
  const checkInMutation = useMutation({
    mutationFn: (appointmentId: string) => api.post(`/appointments/${appointmentId}/check-in`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    }
  });

  return (
    <div className="space-y-6">
      {/* Header with Quick Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-brand-navy">OPD Reception & Patient Desk</h2>
          <p className="text-xs text-slate-500 mt-0.5">Real-time walk-ins, scheduled consultations & token management</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            onClick={() => setIsBookingOpen(true)}
            variant="outline"
            className="border-brand-teal text-brand-teal hover:bg-brand-teal/5"
          >
            <Calendar className="w-4 h-4 mr-1.5" /> Book Consultation
          </Button>
          <Button onClick={() => setIsRegisterOpen(true)} className="bg-brand-teal text-white">
            <UserPlus className="w-4 h-4 mr-1.5" /> Register New Patient
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-4 text-sm font-medium">
        <button
          onClick={() => setActiveTab('APPOINTMENTS')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
            activeTab === 'APPOINTMENTS' ? 'border-brand-teal text-brand-teal font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" /> Today's Appointments & Tokens ({appointments.length})
        </button>
        <button
          onClick={() => setActiveTab('REGISTER')}
          className={`pb-3 px-1 border-b-2 flex items-center gap-2 ${
            activeTab === 'REGISTER' ? 'border-brand-teal text-brand-teal font-semibold' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Users className="w-4 h-4" /> Patient Registry Lookup
        </button>
      </div>

      {/* TAB 1: APPOINTMENTS & LIVE QUEUE */}
      {activeTab === 'APPOINTMENTS' && (
        <Card className="p-0 overflow-hidden">
          <div className="p-4 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-500 font-medium">
              Live token queue &bull; Auto-refreshing every 10s
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-600">Filter Doctor:</span>
              <select
                value={selectedDoctorId}
                onChange={(e) => setSelectedDoctorId(e.target.value)}
                className="text-xs bg-white border border-slate-300 rounded-lg px-2.5 py-1.5 text-slate-800"
              >
                <option value="all">All Doctors</option>
                {doctors.map((d: any) => (
                  <option key={d.doctorProfile?.id} value={d.doctorProfile?.id}>
                    {d.fullName} ({d.doctorProfile?.department?.name})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {apptsLoading ? (
            <div className="p-6">
              <TableSkeleton rows={5} cols={6} />
            </div>
          ) : appointments.length === 0 ? (
            <EmptyState
              title="No consultations scheduled today"
              description="Click 'Book Consultation' or 'Walk-in' to issue a queue token."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-3.5">Token #</th>
                    <th className="p-3.5">Patient Details</th>
                    <th className="p-3.5">Doctor & Dept</th>
                    <th className="p-3.5">Slot / Time</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {appointments.map((a: any) => (
                    <tr key={a.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="p-3.5 font-bold font-mono text-brand-navy">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-light-teal/20 text-brand-navy">
                          #{a.tokenNumber}
                        </span>
                      </td>
                      <td className="p-3.5">
                        <div className="font-semibold text-slate-900">{a.patient.fullName}</div>
                        <div className="text-[11px] text-slate-500 font-mono">
                          {a.patient.patientCode} &bull; {a.patient.gender} ({a.patient.ageYears}y)
                        </div>
                      </td>
                      <td className="p-3.5">
                        <div className="text-slate-800 font-medium">Dr. {a.doctor.user.fullName}</div>
                        <div className="text-[11px] text-slate-500">{a.doctor.department.name}</div>
                      </td>
                      <td className="p-3.5 font-mono text-slate-700">
                        {a.slotStartTime} - {a.slotEndTime}
                      </td>
                      <td className="p-3.5">
                        <Badge
                          variant={
                            a.status === 'COMPLETED'
                              ? 'success'
                              : a.status === 'IN_CONSULT'
                              ? 'info'
                              : a.status === 'CHECKED_IN'
                              ? 'warning'
                              : 'default'
                          }
                        >
                          {a.status.replace('_', ' ')}
                        </Badge>
                      </td>
                      <td className="p-3.5 text-right">
                        {a.status === 'BOOKED' && (
                          <Button
                            size="sm"
                            onClick={() => checkInMutation.mutate(a.id)}
                            isLoading={checkInMutation.isPending}
                            className="bg-brand-teal text-white h-7 text-xs"
                          >
                            <CheckCircle className="w-3.5 h-3.5 mr-1" /> Check In
                          </Button>
                        )}
                        {a.status === 'CHECKED_IN' && (
                          <span className="text-xs text-amber-600 font-medium">Waiting in Lobby</span>
                        )}
                        {a.status === 'IN_CONSULT' && (
                          <span className="text-xs text-sky-600 font-medium animate-pulse">In Doctor Cabin</span>
                        )}
                        {a.status === 'COMPLETED' && (
                          <span className="text-xs text-emerald-600 font-medium">Consulted</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 2: PATIENT SEARCH / LOOKUP */}
      {activeTab === 'REGISTER' && (
        <Card className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search patients by name, mobile number, or CS ID..."
              className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm text-slate-900 focus:outline-none focus:border-brand-teal"
            />
          </div>

          {patientsLoading ? (
            <TableSkeleton rows={4} cols={5} />
          ) : patients.length === 0 ? (
            <EmptyState
              title="No patients match your search"
              description="Register new patient to issue their unique CareSmart Health Code."
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600 font-semibold border-b">
                  <tr>
                    <th className="p-3">Patient Code</th>
                    <th className="p-3">Full Name</th>
                    <th className="p-3">Age / Gender</th>
                    <th className="p-3">Mobile</th>
                    <th className="p-3">Allergies</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {patients.map((p: any) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="p-3 font-mono font-semibold text-brand-navy">{p.patientCode}</td>
                      <td className="p-3 font-medium text-slate-900">{p.fullName}</td>
                      <td className="p-3 text-slate-600">{p.ageYears}y / {p.gender}</td>
                      <td className="p-3 font-mono text-slate-600">{p.phone}</td>
                      <td className="p-3">
                        {p.allergies?.length > 0 ? (
                          <span className="text-rose-600 font-medium">
                            {p.allergies.map((al: any) => al.allergen).join(', ')}
                          </span>
                        ) : (
                          <span className="text-slate-400">None</span>
                        )}
                      </td>
                      <td className="p-3 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setBookForm((b) => ({ ...b, patientId: p.id }));
                            setIsBookingOpen(true);
                          }}
                          className="h-7 text-xs border-brand-teal text-brand-teal"
                        >
                          Book Visit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* MODAL: REGISTER PATIENT */}
      <Modal
        isOpen={isRegisterOpen}
        onClose={() => {
          setIsRegisterOpen(false);
          setDuplicateWarning(null);
        }}
        title="Register New Patient"
        maxWidth="lg"
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            registerMutation.mutate(regForm);
          }}
          className="space-y-4"
        >
          {duplicateWarning && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong>Duplicate Warning:</strong> {duplicateWarning}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Full Name *</label>
              <input
                type="text"
                required
                value={regForm.fullName}
                onChange={(e) => setRegForm({ ...regForm, fullName: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
                placeholder="e.g. Ramesh Chandra"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Gender *</label>
              <select
                value={regForm.gender}
                onChange={(e) => setRegForm({ ...regForm, gender: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
              >
                <option value="MALE">Male</option>
                <option value="FEMALE">Female</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Age (Years) *</label>
              <input
                type="number"
                min="0"
                max="125"
                required
                value={regForm.ageYears}
                onChange={(e) => setRegForm({ ...regForm, ageYears: Number(e.target.value) })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Mobile Phone *</label>
              <input
                type="tel"
                required
                value={regForm.phone}
                onChange={(e) => setRegForm({ ...regForm, phone: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
                placeholder="+919876543210"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Blood Group</label>
              <select
                value={regForm.bloodGroup}
                onChange={(e) => setRegForm({ ...regForm, bloodGroup: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
              >
                <option value="O+">O+</option>
                <option value="O-">O-</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Residential Address</label>
              <input
                type="text"
                value={regForm.address}
                onChange={(e) => setRegForm({ ...regForm, address: e.target.value })}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
                placeholder="Door No, Street, City"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsRegisterOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={registerMutation.isPending} className="bg-brand-teal text-white">
              Complete Registration
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: BOOK CONSULTATION / WALK-IN */}
      <Modal isOpen={isBookingOpen} onClose={() => setIsBookingOpen(false)} title="Book OPD Consultation Token" maxWidth="md">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            bookMutation.mutate(bookForm);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Select Patient *</label>
            <select
              required
              value={bookForm.patientId}
              onChange={(e) => setBookForm({ ...bookForm, patientId: e.target.value })}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
            >
              <option value="">-- Choose registered patient --</option>
              {patients.map((p: any) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.patientCode})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Select Doctor & Department *</label>
            <select
              required
              value={bookForm.doctorId}
              onChange={(e) => {
                const doc = doctors.find((d: any) => d.doctorProfile?.id === e.target.value);
                setBookForm({
                  ...bookForm,
                  doctorId: e.target.value,
                  departmentId: doc?.doctorProfile?.departmentId || ''
                });
              }}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:border-brand-teal focus:outline-none"
            >
              <option value="">-- Choose Doctor --</option>
              {doctors.map((d: any) => (
                <option key={d.doctorProfile?.id} value={d.doctorProfile?.id}>
                  Dr. {d.fullName} - {d.doctorProfile?.department?.name} ({formatINR(d.doctorProfile?.consultationFeePaise)})
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
            <input
              type="checkbox"
              id="walkinCheck"
              checked={bookForm.isWalkIn}
              onChange={(e) => setBookForm({ ...bookForm, isWalkIn: e.target.checked })}
              className="rounded accent-brand-teal"
            />
            <label htmlFor="walkinCheck" className="text-xs font-medium text-slate-800 cursor-pointer">
              Immediate Walk-in (Assign next available token right now)
            </label>
          </div>

          {!bookForm.isWalkIn && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={bookForm.appointmentDate}
                  onChange={(e) => setBookForm({ ...bookForm, appointmentDate: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Slot Time</label>
                <input
                  type="time"
                  value={bookForm.slotStartTime}
                  onChange={(e) => setBookForm({ ...bookForm, slotStartTime: e.target.value, slotEndTime: e.target.value })}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={() => setIsBookingOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" isLoading={bookMutation.isPending} className="bg-brand-teal text-white">
              Issue Token
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
