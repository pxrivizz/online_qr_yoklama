import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock, CheckCircle2, BookOpen, Plus, Eye } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../../hooks/useAuth';
import { sessionAPI } from '../../api/sessionAPI';
import { courseAPI } from '../../api/courseAPI';

export const TeacherDashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Fetch courses
  const { data: coursesData, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: courseAPI.getCourses,
  });

  // Fetch active sessions
  const { data: activeSessionsData } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: sessionAPI.getActiveSessions,
    refetchInterval: 10000, // Fast refresh for teachers
  });

  const courses = useMemo(() => {
    if (!coursesData) return [];
    return Array.isArray(coursesData) ? coursesData : coursesData.courses || [];
  }, [coursesData]);

  const activeSessions = useMemo(() => {
    if (!activeSessionsData) return [];
    return Array.isArray(activeSessionsData)
      ? activeSessionsData
      : activeSessionsData.sessions || [];
  }, [activeSessionsData]);

  const activeSessionByCourseId = useMemo(() => {
    const map = new Map();
    activeSessions.forEach((session) => {
      map.set(session.course_id, session);
    });
    return map;
  }, [activeSessions]);

  const qrSessionCourse = useMemo(() => {
    if (!qrSession?.course_id) return null;
    return courses.find((c) => c.id === qrSession.course_id);
  }, [qrSession, courses]);

  // Handle expiration countdown
  useEffect(() => {
    if (!qrSession?.token_expires_at) {
      setTimeLeft(0);
      return;
    }

    const updateTimeLeft = () => {
      const expiresAt = new Date(qrSession.token_expires_at).getTime();
      const diff = Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
      setTimeLeft(diff);
    };

    updateTimeLeft();
    const interval = setInterval(updateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [qrSession?.token_expires_at]);

  // Refresh QR code dynamically
  useEffect(() => {
    if (!qrSession?.id || timeLeft > 0 || isRefreshing) return;

    const refreshToken = async () => {
      setIsRefreshing(true);
      try {
        const response = await sessionAPI.refreshQRToken(qrSession.id);
        const payload = response?.data ?? response;
        setQrSession((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            qr_token: payload?.qr_token || prev.qr_token,
            token_expires_at: payload?.token_expires_at || prev.token_expires_at,
          };
        });
      } catch (error) {
        console.error('QR refresh error:', error);
        toast.error(error?.response?.data?.error || 'QR yenilenemedi');
      } finally {
        setIsRefreshing(false);
      }
    };

    refreshToken();
  }, [qrSession?.id, timeLeft, isRefreshing]);

  const handleStartSession = async (courseId) => {
    setIsStartingSession(true);
    try {
      const response = await sessionAPI.startSession(courseId);
      const payload = response?.data ?? response;
      setQrSession(payload);
      setIsQrModalOpen(true);
      toast.success('Yoklama başlatıldı!');
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
    } catch (error) {
      console.error('Session start error:', error);
      toast.error(error?.response?.data?.error || 'Yoklama başlatılamadı');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleEndSession = async (courseId) => {
    const activeSession = activeSessionByCourseId.get(courseId);
    const sessionId = activeSession?.id || qrSession?.id;
    
    if (!sessionId) {
      toast.error('Bu ders için aktif oturum bulunamadı');
      return;
    }

    setIsEndingSession(true);
    try {
      await sessionAPI.endSession(sessionId);
      toast.success('Oturum sonlandırıldı');
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
      if (qrSession?.id === sessionId) {
        setQrSession(null);
        setIsQrModalOpen(false);
      }
    } catch (error) {
      console.error('End session error:', error);
      toast.error(error?.response?.data?.error || 'Oturum sonlandırılamadı');
    } finally {
      setIsEndingSession(false);
    }
  };

  return (
    <div className="space-y-8 p-4 max-w-7xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Öğretmen Paneli</h1>
        <p className="text-gray-600 mt-1">Derslerinizi yönetin ve yoklama oturumları başlatın.</p>
      </div>

      {/* Quick Actions for Active Sessions */}
      {activeSessions.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-gray-900">Aktif Yoklamalar</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map((session) => (
              <Card key={session.id} className="border-green-200 bg-green-50/50 p-4 flex justify-between items-center rounded-2xl shadow-sm">
                <div>
                  <h3 className="font-bold text-gray-900">{session.course_name}</h3>
                  <p className="text-xs text-gray-500 font-mono">{session.course_code}</p>
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="secondary" 
                    size="sm" 
                    className="bg-white hover:bg-gray-100 gap-1"
                    onClick={() => {
                      setQrSession(session);
                      setIsQrModalOpen(true);
                    }}
                  >
                    <Eye className="w-4 h-4" />
                    QR Göster
                  </Button>
                  <Button 
                    variant="danger" 
                    size="sm"
                    onClick={() => handleEndSession(session.course_id)}
                  >
                    Bitir
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Courses List */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900">Derslerim</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isCoursesLoading ? (
            <div className="text-gray-400 py-4">Dersler yükleniyor...</div>
          ) : courses.length === 0 ? (
            <div className="text-gray-400 py-4">Henüz ders ataması bulunmuyor.</div>
          ) : (
            courses.map((course) => {
              const isActive = activeSessionByCourseId.has(course.id);
              return (
                <Card 
                  key={course.id} 
                  className="p-5 flex flex-col justify-between rounded-2xl hover:shadow-md transition-shadow border-gray-100"
                >
                  <div className="mb-4 cursor-pointer" onClick={() => navigate(`/courses/${course.id}`)}>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-gray-900">{course.name}</h3>
                        <p className="text-sm text-gray-500 font-mono">{course.code}</p>
                      </div>
                      <BookOpen className="text-gray-300 w-6 h-6 mt-1" />
                    </div>
                  </div>
                  
                  <div>
                    {isActive ? (
                      <div className="flex gap-3">
                        <Button 
                          variant="secondary" 
                          className="flex-1"
                          onClick={() => {
                            const activeSession = activeSessionByCourseId.get(course.id);
                            setQrSession(activeSession);
                            setIsQrModalOpen(true);
                          }}
                        >
                          QR Göster
                        </Button>
                        <Button 
                          variant="danger" 
                          className="flex-1"
                          onClick={() => handleEndSession(course.id)}
                        >
                          Bitir
                        </Button>
                      </div>
                    ) : (
                      <Button 
                        variant="primary" 
                        className="w-full bg-[#10B981] hover:bg-[#059669]"
                        onClick={() => handleStartSession(course.id)}
                      >
                        Yoklama Başlat
                      </Button>
                    )}
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* QR Code Modal (Adapts perfectly for mobile/desktop) */}
      <Modal 
        isOpen={isQrModalOpen} 
        onClose={() => setIsQrModalOpen(false)} 
        title="Yoklama QR Kodu" 
        size="lg"
      >
        <div className="flex flex-col items-center space-y-6">
          {qrSessionCourse && (
            <div className="text-center">
              <h3 className="text-2xl font-extrabold text-gray-900">{qrSessionCourse.name}</h3>
              <p className="text-gray-500 font-mono text-sm">{qrSessionCourse.code}</p>
            </div>
          )}

          {qrSession ? (
            <div className="flex flex-col items-center gap-4 p-6 bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="p-4 bg-gray-50 rounded-2xl border border-gray-200">
                <QRCodeSVG
                  value={qrSession.qr_token || ''}
                  size={280}
                  fgColor="#1E3A5F"
                  bgColor="#FFFFFF"
                  includeMargin
                />
              </div>
              <div className="text-base font-semibold text-gray-700">
                Kalan süre: <span className="text-green-600 font-bold text-xl">{timeLeft}s</span>
              </div>
              {isRefreshing && <span className="text-xs text-gray-400 animate-pulse">Token yenileniyor...</span>}
            </div>
          ) : (
            <div className="text-gray-400 py-8">QR Kod yükleniyor...</div>
          )}

          <Button 
            variant="secondary" 
            onClick={() => setIsQrModalOpen(false)}
            className="w-full md:w-auto px-8 py-3 rounded-xl"
          >
            Kapat
          </Button>
        </div>
      </Modal>
    </div>
  );
};
export default TeacherDashboard;
