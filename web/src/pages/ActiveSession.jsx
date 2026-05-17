import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Clock, StopCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { sessionAPI } from '../api/sessionAPI';
import { courseAPI } from '../api/courseAPI';
import { attendanceAPI } from '../api/attendanceAPI';

export const ActiveSession = () => {
  const { id: sessionId } = useParams();
  const [session, setSession] = useState(null);
  const [students, setStudents] = useState([]);
  const [attendances, setAttendances] = useState([]);
  const [timeLeft, setTimeLeft] = useState(28);
  const [loading, setLoading] = useState(true);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStudents, setSelectedStudents] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchSessionData = async () => {
    try {
      setLoading(true);
      const sessionData = await sessionAPI.getSessionById(sessionId);
      setSession(sessionData);
      if (sessionData?.course_id) {
        const studentsData = await courseAPI.getCourseStudents(sessionData.course_id);
        setStudents(studentsData.data || studentsData || []);
      }
      const attendancesData = await sessionAPI.getSessionAttendances(sessionId);
      setAttendances(attendancesData || []);
    } catch (error) {
      console.error('Error loading session data:', error);
      toast.error('Veriler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSessionData(); }, [sessionId]);

  useEffect(() => {
    if (!session?.is_active) return;
    const interval = setInterval(async () => {
      try {
        const refreshed = await sessionAPI.refreshQRToken(sessionId);
        setSession(prev => ({ ...prev, qr_token: refreshed.qr_token }));
        setTimeLeft(28);
      } catch (error) { console.error('Failed to refresh QR token:', error); }
    }, 28000);
    const timer = setInterval(() => { setTimeLeft((prev) => (prev > 0 ? prev - 1 : 28)); }, 1000);
    return () => { clearInterval(interval); clearInterval(timer); };
  }, [session?.is_active, sessionId]);

  const handleEndSession = async () => {
    try {
      await sessionAPI.endSession(sessionId);
      toast.success('Oturum sonlandırıldı');
      setSession(prev => ({ ...prev, is_active: false }));
    } catch (error) {
      console.error('Failed to end session:', error);
      toast.error('Oturum sonlandırılamadı');
    }
  };

  const filteredStudents = students.filter(student =>
    (student.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (student.student_number || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const attendanceSet = useMemo(() => {
    return new Set(attendances.filter(a => a.is_valid).map(a => a.student_id));
  }, [attendances]);
  const isStudentPresent = (studentId) => attendanceSet.has(studentId);

  const handleCheckboxChange = (studentId) => {
    setSelectedStudents(prev =>
      prev.includes(studentId) ? prev.filter(id => id !== studentId) : [...prev, studentId]
    );
  };

  const handleManualSubmit = async () => {
    if (selectedStudents.length === 0) { toast.error('Lütfen öğrenci seçin'); return; }
    setIsSubmitting(true);
    try {
      await attendanceAPI.markManual(sessionId, selectedStudents);
      toast.success(`${selectedStudents.length} öğrenci yoklamaya eklendi`);
      setIsManualOpen(false);
      setSelectedStudents([]);
      const updated = await sessionAPI.getSessionAttendances(sessionId);
      setAttendances(updated || []);
    } catch (error) {
      console.error('Manual attendance error:', error);
      toast.error('Manuel yoklama ekleme başarısız');
    } finally { setIsSubmitting(false); }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-slate-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const progress = (timeLeft / 28) * 100;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-slide-up">
          <h1 className="page-title">Yoklama Oturumu</h1>
          <p className="page-subtitle">{session?.course_name || 'Ders Bilgisi'}</p>
        </div>
        <div className="flex gap-3">
          <Button variant="primary" size="md" className="gap-2" onClick={() => setIsManualOpen(true)}>
            Manuel Yoklama
          </Button>
          {session?.is_active && (
            <Button variant="danger" size="md" className="gap-2" onClick={handleEndSession}>
              <StopCircle size={16} />
              Oturumu Sonlandır
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="flex flex-col items-center justify-center py-12">
            <div className="mb-6">
              {session?.is_active && session?.qr_token ? (
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100">
                  <QRCodeSVG value={session.qr_token} size={280} bgColor="#FFFFFF" fgColor="#1E3A5F" level="H" includeMargin={true} />
                </div>
              ) : (
                <div className="text-slate-400 text-lg font-medium py-24">Oturum Sonlandırıldı</div>
              )}
            </div>
          </Card>

          {session?.is_active && (
            <Card className="flex flex-col items-center py-8">
              <p className="text-xs text-slate-500 mb-6 font-medium uppercase tracking-wider">QR otomatik yenileniyor</p>
              <div className="relative w-36 h-36 mb-6">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#E2E8F0" strokeWidth="6" />
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#10B981" strokeWidth="6"
                    strokeDasharray={`${(progress / 100) * (2 * Math.PI * 45)} ${2 * Math.PI * 45}`}
                    strokeLinecap="round" style={{ transition: 'stroke-dasharray 0.3s ease' }} />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <p className="text-3xl font-extrabold text-slate-900">{timeLeft}</p>
                    <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider mt-0.5">saniye</p>
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400 text-center">QR kod her 28 saniyede bir otomatik olarak yenilenmektedir</p>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          <Card>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">Mevcut Öğrenciler</h3>
              <span className="inline-flex items-center justify-center w-7 h-7 bg-emerald-50 rounded-xl text-sm font-bold text-emerald-700">
                {attendances.length}
              </span>
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {attendances.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between py-2.5 px-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">{att.name || att.student_name || 'Öğrenci'}</p>
                    <p className="text-xs text-slate-400">{att.student_number || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-slate-400">
                      {att.marked_at ? new Date(att.marked_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                    <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center">
                      <span className="text-emerald-600 text-xs font-bold">✓</span>
                    </div>
                  </div>
                </div>
              ))}
              {attendances.length === 0 && (
                <div className="text-slate-400 text-sm text-center py-8">Henüz gelen öğrenci yok.</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      <Modal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} title="Manuel Yoklama Ekle" size="lg">
        <div className="space-y-4">
          <input type="text" placeholder="Öğrenci adı veya numarası ile filtrele..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)} className="input" />
          <div className="max-h-[400px] overflow-y-auto space-y-1">
            {filteredStudents.map((student) => {
              const present = isStudentPresent(student.id);
              const selected = selectedStudents.includes(student.id);
              return (
                <div key={student.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input type="checkbox" id={`student-${student.id}`} checked={present || selected} disabled={present}
                      onChange={() => handleCheckboxChange(student.id)}
                      className="rounded-md text-emerald-600 focus:ring-emerald-500 disabled:bg-slate-200 h-4 w-4 cursor-pointer disabled:cursor-not-allowed" />
                    <label htmlFor={`student-${student.id}`} className={`text-sm font-medium truncate ${present ? 'text-slate-400' : 'text-slate-800 cursor-pointer'}`}>
                      {student.name} <span className="text-slate-400 font-normal">({student.student_number || '-'})</span>
                    </label>
                  </div>
                  {present && <span className="badge-success text-xs ml-2">✓ Mevcut</span>}
                </div>
              );
            })}
            {filteredStudents.length === 0 && <div className="text-center py-6 text-sm text-slate-400">Öğrenci bulunamadı.</div>}
          </div>
          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsManualOpen(false)}>İptal</Button>
            <Button variant="success" type="button" onClick={handleManualSubmit} loading={isSubmitting} disabled={selectedStudents.length === 0}>
              Seçilenleri İşaretle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
