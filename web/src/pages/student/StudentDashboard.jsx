import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { sessionAPI } from '../../api/sessionAPI';
import { courseAPI } from '../../api/courseAPI';
import { attendanceAPI } from '../../api/attendanceAPI';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { LogOut, Scan, BookOpen, UserCircle, AlertTriangle } from 'lucide-react';

export const StudentDashboard = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const { data: coursesData = [] } = useQuery({
    queryKey: ['studentCourses'],
    queryFn: courseAPI.getCourses,
    refetchInterval: 15000,
    enabled: !!user,
  });

  const { data: activeSessionsData = [], refetch: refetchActiveSessions } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: sessionAPI.getActiveSessions,
    refetchInterval: 15000,
    enabled: !!user,
  });

  const { data: myAttendances = [], isLoading } = useQuery({
    queryKey: ['myAttendances'],
    queryFn: attendanceAPI.getMyAttendances,
    refetchInterval: 30000,
    retry: 1,
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center">
        <div className="text-center animate-fade-in">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-emerald-500 border-t-transparent mx-auto mb-4" />
          <p className="text-sm text-slate-500">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  const enrolledCourseIds = new Set(
    Array.isArray(coursesData) ? coursesData.map(c => c.id) : []
  );

  const relevantActiveSessions = Array.isArray(activeSessionsData)
    ? activeSessionsData.filter(s => enrolledCourseIds.has(s.course_id) && s.is_active)
    : [];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const hasAvatar = !!user?.avatar_url;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Mobile Header */}
      <header className="bg-gradient-to-r from-[#1E3A5F] to-[#152D4A] text-white px-4 py-3.5 flex justify-between items-center shadow-lg sticky top-0 z-50">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-sm">
            <span className="text-xs font-extrabold">QR</span>
          </div>
          <span className="font-bold text-base tracking-tight">QR Katılım</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/student/profile')}
            className="p-2 rounded-xl hover:bg-white/10 transition-all duration-200 relative"
            title="Profil"
          >
            <UserCircle className="w-5 h-5" />
            {!hasAvatar && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[#1E3A5F]" />
            )}
          </button>
          <span className="text-sm font-medium text-slate-300 max-w-[100px] truncate">
            {user?.name}
          </span>
          <button
            onClick={handleLogout}
            className="p-2 rounded-xl hover:bg-white/10 transition-all duration-200"
            title="Çıkış Yap"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="flex-1 p-4 space-y-5 max-w-3xl mx-auto w-full">
        {/* Avatar Warning Banner */}
        {!hasAvatar && (
          <button
            onClick={() => navigate('/student/profile')}
            className="w-full bg-rose-50 border border-rose-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-rose-100 transition-all duration-200 animate-slide-up"
          >
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-800">Profil Fotoğrafı Yükleyin</p>
              <p className="text-xs text-rose-600">Yoklamaya katılmak için profil fotoğrafınızı yüklemeniz gerekiyor.</p>
            </div>
          </button>
        )}

        {/* Active Session Area Header */}
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            Aktif Yoklamalar
          </h2>
          <button 
            onClick={() => refetchActiveSessions()}
            className="text-xs font-bold text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg hover:bg-slate-50 transition-colors shadow-sm active:scale-95"
          >
            Yenile
          </button>
        </div>

        {/* Active Session Banner */}
        {relevantActiveSessions.length > 0 ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 shadow-sm animate-slide-up">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex items-center gap-2 text-emerald-800 font-bold text-base">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Yoklama Açık: {relevantActiveSessions[0].course_name}</span>
              </div>
              <Button
                variant="primary"
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center gap-2 text-base font-bold rounded-xl shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.97]"
                onClick={() => navigate('/student/scan')}
              >
                <Scan className="w-5 h-5" />
                QR Tara
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-5 text-slate-400 bg-white border border-slate-100 rounded-2xl text-sm shadow-sm">
            📭 Şu an açık bir yoklama oturumu bulunmuyor.
          </div>
        )}

        {/* Course List */}
        <div className="space-y-4">
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-slate-500" />
            Derslerim
          </h2>

          {myAttendances.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              Herhangi bir derse kaydınız bulunmamaktadır.
            </div>
          ) : (
            <div className="grid gap-3.5">
              {myAttendances.map((course) => {
                const percent = course.attendance_percentage || 0;
                let progressColor = 'bg-rose-500';
                if (percent >= 70) progressColor = 'bg-emerald-500';
                else if (percent >= 60) progressColor = 'bg-amber-500';

                return (
                  <Card key={course.course_id} className="!p-4 shadow-sm !border-slate-100 !rounded-2xl hover:shadow-md transition-all duration-200">
                    <div className="flex justify-between items-start mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="font-bold text-slate-900 text-sm leading-snug truncate">{course.course_name}</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5 font-mono">{course.course_code}</p>
                      </div>
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-lg shrink-0 ml-3 ${percent >= 70 ? 'bg-emerald-50 text-emerald-700' : percent >= 60 ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'}`}>
                        %{percent}
                      </span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-2 overflow-hidden">
                      <div className={`h-full rounded-full ${progressColor} transition-all duration-500`} style={{ width: `${percent}%` }} />
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500">
                      <span>Katılım Durumu</span>
                      <span className="font-medium">{course.attended} / {course.total_sessions} ders</span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};
export default StudentDashboard;
