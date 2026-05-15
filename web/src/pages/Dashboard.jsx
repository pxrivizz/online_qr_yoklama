import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BarChart3, Clock, CheckCircle2, BookOpen, Plus } from 'lucide-react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '../hooks/useAuth';
import { sessionAPI } from '../api/sessionAPI';
import { courseAPI } from '../api/courseAPI';
import { attendanceAPI } from '../api/attendanceAPI';

export const Dashboard = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const isTeacher = user?.role === 'teacher' || user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: coursesData, isLoading: isCoursesLoading } = useQuery({
    queryKey: ['courses'],
    queryFn: courseAPI.getCourses,
  });

  const { data: activeSessionsData } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: sessionAPI.getActiveSessions,
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

  const activeSessionCourseIds = useMemo(
    () => new Set(activeSessions.map((session) => session.course_id)),
    [activeSessions]
  );

  const activeSessionByCourseId = useMemo(() => {
    const map = new Map();
    activeSessions.forEach((session) => {
      map.set(session.course_id, session);
    });
    return map;
  }, [activeSessions]);

  useEffect(() => {
    if (courses.length > 0) {
      console.log('courses from API:', courses);
    }
  }, [courses]);

  const qrSessionCourse = useMemo(() => {
    if (!qrSession?.course_id) return null;
    return courses.find((c) => c.id === qrSession.course_id);
  }, [qrSession, courses]);

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
    console.log('Yoklama başlatılıyor, courseId:', courseId);
    setIsStartingSession(true);
    try {
      const response = await sessionAPI.startSession(courseId);
      const payload = response?.data ?? response;
      setQrSession(payload);
      setIsQrModalOpen(true);
      toast.success('Yoklama başlatıldı!');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
    } catch (error) {
      console.error('Hata:', error);
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Yoklama başlatılamadı');
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

  const handleAddCourse = () => {
    navigate('/courses');
  };

  const handleCloseQrModal = () => {
    if (isEndingSession || isStartingSession) return;
    setIsQrModalOpen(false);
  };

    if (isStudent) {
      return <StudentDashboard />;
    }

  // Teacher/Admin Dashboard
  return (
    <div className="space-y-8">
      {/* Welcome Section */}
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Hoş Geldiniz</h1>
        <p className="text-gray-600">Bugün yapmanız gereken işleri burada görebilirsiniz</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          icon={<BookOpen className="w-8 h-8" />}
          label="Toplam Ders"
          value={String(courses.length)}
          color="bg-blue-50"
          iconColor="text-blue-600"
        />
        <StatCard
          icon={<Clock className="w-8 h-8" />}
          label="Aktif Oturum"
          value={String(activeSessions.length)}
          color="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          icon={<CheckCircle2 className="w-8 h-8" />}
          label="Bugünkü Yoklama"
          value="150"
          color="bg-purple-50"
          iconColor="text-purple-600"
        />
      </div>

      {/* My Courses Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">Derslerim</h2>
          <div className="flex items-center gap-3">
            <Button variant="primary" size="md" className="gap-2" onClick={handleAddCourse}>
              <Plus size={18} />
              Yeni Ders Ekle
            </Button>
          </div>
        </div>

        {/* Courses Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {isCoursesLoading ? (
            <div className="text-sm text-gray-500">Dersler yükleniyor...</div>
          ) : courses.length === 0 ? (
            <div className="text-sm text-gray-500">Henüz ders bulunamadı.</div>
          ) : courses.map((course) => {
            const isActive = activeSessionCourseIds.has(course.id);

            return (
              <div
                key={course.id}
                className="card group cursor-pointer hover:shadow-lg transition-all duration-200"
                onClick={() => navigate(`/courses/${course.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">{course.name}</h3>
                    <p className="text-sm text-gray-500">{course.code}</p>
                  </div>
                  <div className="text-2xl opacity-50 group-hover:opacity-100 transition">📚</div>
                </div>

                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-gray-100 mr-2">
                      👥
                    </span>
                    {course.students || course.student_count || '-'} Öğrenci
                  </div>
                </div>

                {isActive ? (
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const activeSession = activeSessionByCourseId.get(course.id);
                        setQrSession(activeSession);
                        setIsQrModalOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[#10B981] hover:bg-[#059669] transition-colors"
                    >
                      <CheckCircle2 size={16} />
                      QR Kodu
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEndSession(course.id);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                    >
                      Oturumu Bitir
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleStartSession(course.id);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white bg-[#10B981] hover:bg-[#059669] transition-colors"
                  >
                    <CheckCircle2 size={16} />
                    Yoklama Başlat
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={isQrModalOpen} onClose={handleCloseQrModal} title="Yoklama QR Kodu" size="lg">
        <div className="space-y-4">
          {qrSessionCourse && (
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-gray-900">{qrSessionCourse.name}</h3>
              <p className="text-sm text-gray-500">{qrSessionCourse.code}</p>
            </div>
          )}

          {qrSession ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-gray-100 bg-gray-50 p-6">
              <QRCodeSVG
                value={qrSession.qr_token || ''}
                size={220}
                fgColor="#1E3A5F"
                bgColor="#FFFFFF"
                includeMargin
              />
              <div className="text-sm text-gray-700">
                Kalan süre: <span className="font-semibold">{timeLeft}s</span>
                {isRefreshing && <span className="ml-2 text-xs text-gray-500">Yenileniyor...</span>}
              </div>
              <div className="text-xs text-gray-500">Oturum ID: {qrSession.id}</div>
            </div>
          ) : (
            <div className="text-sm text-gray-500 text-center">Yoklama oturumu yükleniyor...</div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={handleCloseQrModal} disabled={isEndingSession}>
              Kapat
            </Button>
            {qrSession && (
              <Button
                variant="danger"
                type="button"
                onClick={() => handleEndSession(qrSession.course_id)}
                loading={isEndingSession}
              >
                Oturumu Sonlandır
              </Button>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};

const StatCard = ({ icon, label, value, color, iconColor }) => (
  <div className="card">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-2">{label}</p>
        <p className="text-3xl font-bold text-gray-900">{value}</p>
      </div>
      <div className={`p-3 rounded-lg ${color}`}>
        <div className={iconColor}>{icon}</div>
      </div>
    </div>
  </div>
);

const StudentDashboard = () => {
  const { data: attendanceData, isLoading } = useQuery({
    queryKey: ['myAttendances'],
    queryFn: attendanceAPI.getMyAttendances,
  });

  const myAttendances = useMemo(() => {
    if (!attendanceData) return [];
    return Array.isArray(attendanceData) ? attendanceData : attendanceData.attendances || [];
  }, [attendanceData]);

  const attendedCoursesCount = myAttendances.filter((course) => (course.attended || 0) > 0).length;
  const averageAttendance = myAttendances.length
    ? Math.round(
        myAttendances.reduce((sum, course) => sum + Number(course.attendance_percentage || 0), 0) /
          myAttendances.length
      )
    : 0;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8FAFC]">
        <div className="text-sm text-gray-500">Yükleniyor...</div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Akademik Performans</h1>
        <p className="text-gray-600">Yoklama durumunuzu ve katılım oranınızı görebilirsiniz</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <StatCard
          icon={<CheckCircle2 className="w-8 h-8" />}
          label="Katıldığım Dersler"
          value={String(attendedCoursesCount)}
          color="bg-green-50"
          iconColor="text-green-600"
        />
        <StatCard
          icon={<BarChart3 className="w-8 h-8" />}
          label="Ortalama Katılım"
          value={`${averageAttendance}%`}
          color="bg-blue-50"
          iconColor="text-blue-600"
        />
      </div>

      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Derslere Göre Yoklama</h2>
        <div className="space-y-4">
          {myAttendances.length === 0 ? (
            <div className="card text-sm text-gray-500">Henüz ders kaydı bulunamadı.</div>
          ) : (
            myAttendances.map((course) => {
              const percentage = Number(course.attendance_percentage || 0);
              const attended = Number(course.attended || 0);
              const total = Number(course.total_sessions || 0);

              return (
                <div key={course.course_id} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">{course.course_name}</h3>
                      <p className="text-sm text-gray-600">{course.course_code}</p>
                    </div>
                    <div className={`text-lg font-bold ${percentage >= 70 ? 'text-green-600' : percentage >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {percentage}%
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        percentage >= 70 ? 'bg-green-500' : percentage >= 60 ? 'bg-yellow-500' : 'bg-red-500'
                      }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-sm text-gray-600">{attended}/{total} derse katıldınız</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
