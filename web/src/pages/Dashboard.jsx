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
      <div className="animate-slide-up">
        <h1 className="page-title">Hoş Geldiniz 👋</h1>
        <p className="page-subtitle">Bugün yapmanız gereken işleri burada görebilirsiniz</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        <StatCard
          icon={<BookOpen className="w-6 h-6" />}
          label="Toplam Ders"
          value={String(courses.length)}
          color="bg-sky-50"
          iconColor="text-sky-600"
          borderColor="border-sky-100"
        />
        <StatCard
          icon={<Clock className="w-6 h-6" />}
          label="Aktif Oturum"
          value={String(activeSessions.length)}
          color="bg-emerald-50"
          iconColor="text-emerald-600"
          borderColor="border-emerald-100"
        />
        <StatCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          label="Bugünkü Yoklama"
          value="0" // Şu kısımda bug var bunun düzelt
          color="bg-violet-50"
          iconColor="text-violet-600"
          borderColor="border-violet-100"
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="section-title">Derslerim</h2>
          <Button variant="primary" size="md" className="gap-2" onClick={handleAddCourse}>
            <Plus size={16} />
            Yeni Ders Ekle
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {isCoursesLoading ? (
            Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="card animate-pulse space-y-4">
                <div className="h-5 bg-slate-100 rounded-lg w-3/4" />
                <div className="h-4 bg-slate-100 rounded-lg w-1/2" />
                <div className="h-10 bg-slate-100 rounded-xl" />
              </div>
            ))
          ) : courses.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-7 h-7 text-slate-400" />
              </div>
              <p className="text-sm text-slate-500 font-medium">Henüz ders bulunamadı.</p>
              <p className="text-xs text-slate-400 mt-1">Yeni ders ekleyerek başlayın</p>
            </div>
          ) : courses.map((course) => {
            const isActive = activeSessionCourseIds.has(course.id);

            return (
              <div
                key={course.id}
                className="card-interactive group"
                onClick={() => navigate(`/courses/${course.id}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-900 mb-0.5 group-hover:text-emerald-600 transition-colors">{course.name}</h3>
                    <p className="text-xs text-slate-500 font-mono">{course.code}</p>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center group-hover:bg-emerald-50 transition-colors">
                    <BookOpen className="w-5 h-5 text-slate-400 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </div>

                <div className="flex items-center gap-2 text-sm text-slate-500 mb-4">
                  <div className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-1 rounded-lg">
                    <span className="text-xs">👥</span>
                    <span className="text-xs font-medium">{course.students || course.student_count || '-'} Öğrenci</span>
                  </div>
                  {isActive && (
                    <div className="flex items-center gap-1.5 bg-emerald-50 px-2.5 py-1 rounded-lg">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      <span className="text-xs font-medium text-emerald-700">Aktif</span>
                    </div>
                  )}
                </div>

                {isActive ? (
                  <div className="flex items-center gap-2.5">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        const activeSession = activeSessionByCourseId.get(course.id);
                        setQrSession(activeSession);
                        setIsQrModalOpen(true);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-emerald-500 hover:bg-emerald-600 transition-all duration-200 active:scale-[0.97]"
                    >
                      <CheckCircle2 size={15} />
                      QR Kodu
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEndSession(course.id);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white bg-rose-500 hover:bg-rose-600 transition-all duration-200 active:scale-[0.97]"
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
                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 hover:border-emerald-300 transition-all duration-200 active:scale-[0.97]"
                  >
                    <CheckCircle2 size={15} />
                    Yoklama Başlat
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Modal isOpen={isQrModalOpen} onClose={handleCloseQrModal} title="Yoklama QR Kodu" size="lg">
        <div className="space-y-5">
          {qrSessionCourse && (
            <div className="text-center">
              <h3 className="text-xl font-bold text-slate-900">{qrSessionCourse.name}</h3>
              <p className="text-sm text-slate-500 font-mono">{qrSessionCourse.code}</p>
            </div>
          )}

          {qrSession ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-8">
              <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
                <QRCodeSVG
                  value={qrSession.qr_token || ''}
                  size={220}
                  fgColor="#1E3A5F"
                  bgColor="#FFFFFF"
                  includeMargin
                />
              </div>
              <div className="text-sm text-slate-700 font-medium">
                Kalan süre: <span className="text-emerald-600 font-bold text-lg">{timeLeft}s</span>
                {isRefreshing && <span className="ml-2 text-xs text-slate-400 animate-pulse">Yenileniyor...</span>}
              </div>
              <div className="text-xs text-slate-400 font-mono">Oturum ID: {qrSession.id}</div>
            </div>
          ) : (
            <div className="text-sm text-slate-500 text-center py-8">Yoklama oturumu yükleniyor...</div>
          )}

          <div className="flex justify-end gap-3 pt-2">
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

const StatCard = ({ icon, label, value, color, iconColor, borderColor }) => (
  <div className={`card !border-${borderColor?.replace('border-', '') || 'slate-100'}`}>
    <div className="flex items-start justify-between">
      <div>
        <p className="text-sm font-medium text-slate-500 mb-1">{label}</p>
        <p className="text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent mx-auto mb-4" />
          <div className="text-sm text-slate-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="animate-slide-up">
        <h1 className="page-title">Akademik Performans</h1>
        <p className="page-subtitle">Yoklama durumunuzu ve katılım oranınızı görebilirsiniz</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <StatCard
          icon={<CheckCircle2 className="w-6 h-6" />}
          label="Katıldığım Dersler"
          value={String(attendedCoursesCount)}
          color="bg-emerald-50"
          iconColor="text-emerald-600"
        />
        <StatCard
          icon={<BarChart3 className="w-6 h-6" />}
          label="Ortalama Katılım"
          value={`${averageAttendance}%`}
          color="bg-sky-50"
          iconColor="text-sky-600"
        />
      </div>

      <div>
        <h2 className="section-title mb-5">Derslere Göre Yoklama</h2>
        <div className="space-y-4">
          {myAttendances.length === 0 ? (
            <div className="card text-center py-8">
              <p className="text-sm text-slate-500">Henüz ders kaydı bulunamadı.</p>
            </div>
          ) : (
            myAttendances.map((course) => {
              const percentage = Number(course.attendance_percentage || 0);
              const attended = Number(course.attended || 0);
              const total = Number(course.total_sessions || 0);

              return (
                <div key={course.course_id} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-900">{course.course_name}</h3>
                      <p className="text-xs text-slate-500 font-mono">{course.course_code}</p>
                    </div>
                    <div className={`text-lg font-extrabold ${percentage >= 70 ? 'text-emerald-600' : percentage >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>
                      {percentage}%
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-500 ${percentage >= 70 ? 'bg-emerald-500' : percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'
                        }`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500">{attended}/{total} derse katıldınız</p>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
