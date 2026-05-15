import { useEffect, useState } from 'react';
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

  // Modal & Selection States
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

  useEffect(() => {
    fetchSessionData();
  }, [sessionId]);

  // QR Token Refresh & Timer Loop
  useEffect(() => {
    if (!session?.is_active) return;

    const interval = setInterval(async () => {
      try {
        const refreshed = await sessionAPI.refreshQRToken(sessionId);
        setSession(prev => ({ ...prev, qr_token: refreshed.qr_token }));
        setTimeLeft(28);
      } catch (error) {
        console.error('Failed to refresh QR token:', error);
      }
    }, 28000);

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 28));
    }, 1000);

    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
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

  const isStudentPresent = (studentId) => {
    return attendances.some(att => att.student_id === studentId && att.is_valid);
  };

  const handleCheckboxChange = (studentId) => {
    setSelectedStudents(prev => 
      prev.includes(studentId) 
        ? prev.filter(id => id !== studentId)
        : [...prev, studentId]
    );
  };

  const handleManualSubmit = async () => {
    if (selectedStudents.length === 0) {
      toast.error('Lütfen öğrenci seçin');
      return;
    }
    
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
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12 text-gray-600">Yükleniyor...</div>;
  }

  const progress = (timeLeft / 28) * 100;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Yoklama Oturumu</h1>
          <p className="text-gray-600 mt-1">{session?.course_name || 'Ders Bilgisi'}</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => setIsManualOpen(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700"
          >
            Manuel Yoklama
          </button>
          {session?.is_active && (
            <Button 
              variant="danger" 
              size="md" 
              className="gap-2"
              onClick={handleEndSession}
            >
              <StopCircle size={18} />
              Oturumu Sonlandır
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* QR Code Section */}
        <div className="lg:col-span-2 space-y-6">
          {/* QR Code Card */}
          <Card className="flex flex-col items-center justify-center py-12">
            <div className="mb-6">
              {session?.is_active && session?.qr_token ? (
                <QRCodeSVG
                  value={session.qr_token}
                  size={300}
                  bgColor="#FFFFFF"
                  fgColor="#1E3A5F"
                  level="H"
                  includeMargin={true}
                />
              ) : (
                <div className="text-gray-500 text-lg font-medium py-24">Oturum Sonlandırıldı</div>
              )}
            </div>
          </Card>

          {/* Timer Section */}
          {session?.is_active && (
            <Card className="flex flex-col items-center py-8">
              <p className="text-sm text-gray-600 mb-6 font-medium">QR otomatik yenileniyor</p>

              <div className="relative w-40 h-40 mb-6">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="45" fill="none" stroke="#E5E7EB" strokeWidth="8" />
                  <circle
                    cx="50"
                    cy="50"
                    r="45"
                    fill="none"
                    stroke="#10B981"
                    strokeWidth="8"
                    strokeDasharray={`${(progress / 100) * (2 * Math.PI * 45)} ${2 * Math.PI * 45}`}
                    strokeLinecap="round"
                    style={{ transition: 'stroke-dasharray 0.1s linear' }}
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <Clock className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                    <p className="text-4xl font-bold text-gray-900">{timeLeft}</p>
                    <p className="text-xs text-gray-500 mt-1">saniye</p>
                  </div>
                </div>
              </div>

              <p className="text-xs text-gray-500 text-center">QR kod her 28 saniyede bir otomatik olarak yenilenmektedir</p>
            </Card>
          )}
        </div>

        {/* Attendance List */}
        <div className="lg:col-span-1">
          <Card>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-gray-200">
              <h3 className="font-bold text-gray-900">Mevcut Öğrenciler</h3>
              <span className="inline-flex items-center justify-center w-7 h-7 bg-green-100 rounded-full">
                <span className="text-sm font-bold text-green-700">{attendances.length}</span>
              </span>
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {attendances.map((att, idx) => (
                <div key={idx} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 truncate">{att.name || att.student_name || 'Öğrenci'}</p>
                    <p className="text-xs text-gray-500">{att.student_number || '-'}</p>
                  </div>
                  <div className="flex items-center gap-2 ml-2">
                    <span className="text-xs text-gray-500">
                      {att.marked_at ? new Date(att.marked_at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '-'}
                    </span>
                    <div className="text-green-600 font-bold">✓</div>
                  </div>
                </div>
              ))}

              {attendances.length === 0 && (
                <div className="text-gray-500 text-sm text-center py-6">Henüz gelen öğrenci yok.</div>
              )}
            </div>
          </Card>
        </div>
      </div>

      {/* Manual Attendance Modal */}
      <Modal isOpen={isManualOpen} onClose={() => setIsManualOpen(false)} title="Manuel Yoklama Ekle" size="lg">
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Öğrenci adı veya numarası ile filtrele..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border-gray-300 shadow-sm focus:border-[#1E3A5F] focus:ring-[#1E3A5F] text-sm"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-2 divide-y divide-gray-100">
            {filteredStudents.map((student) => {
              const present = isStudentPresent(student.id);
              const selected = selectedStudents.includes(student.id);
              
              return (
                <div key={student.id} className="flex items-center justify-between py-3 first:pt-0">
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    <input
                      type="checkbox"
                      id={`student-${student.id}`}
                      checked={present || selected}
                      disabled={present}
                      onChange={() => handleCheckboxChange(student.id)}
                      className="rounded text-[#1E3A5F] focus:ring-[#1E3A5F] disabled:bg-gray-200 disabled:text-gray-400 h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                    />
                    <label 
                      htmlFor={`student-${student.id}`} 
                      className={`text-sm font-medium truncate ${present ? 'text-gray-400' : 'text-gray-900 cursor-pointer'}`}
                    >
                      {student.name} <span className="text-gray-500 font-normal">({student.student_number || '-'})</span>
                    </label>
                  </div>
                  {present && (
                    <div className="text-green-600 text-sm font-bold flex items-center gap-1 ml-2">
                      ✓ Mevcut
                    </div>
                  )}
                </div>
              );
            })}

            {filteredStudents.length === 0 && (
              <div className="text-center py-6 text-sm text-gray-500">
                Öğrenci bulunamadı.
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
            <Button variant="secondary" type="button" onClick={() => setIsModalOpen(false)}>
              İptal
            </Button>
            <Button
              variant="primary"
              type="button"
              className="bg-green-600 hover:bg-green-700 text-white border-none"
              onClick={handleManualSubmit}
              loading={isSubmitting}
              disabled={selectedStudents.length === 0}
            >
              Seçilenleri İşaretle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
