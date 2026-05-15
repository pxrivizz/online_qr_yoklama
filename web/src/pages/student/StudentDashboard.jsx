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

  // Fetch active sessions
  const { data: activeSessions = [], isError: sessionsError } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: sessionAPI.getActiveSessions,
    refetchInterval: 30000,
    retry: 1,
  });

  // Fetch attendance summaries (gives us enrolled courses)
  const { data: myAttendances = [], isError: attendanceError, isLoading } = useQuery({
    queryKey: ['myAttendances'],
    queryFn: attendanceAPI.getMyAttendances,
    refetchInterval: 30000,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#1E3A5F] mx-auto mb-4" />
          <p className="text-gray-600">Yükleniyor...</p>
        </div>
      </div>
    );
  }

  // Filter active sessions to only those belonging to enrolled courses
  const enrolledCourseIds = myAttendances.map(att => att.course_id);
  const relevantActiveSessions = activeSessions.filter(session =>
    enrolledCourseIds.includes(session.course_id) && session.is_active
  );

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const hasAvatar = !!user?.avatar_url;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Mobile Header */}
      <header className="bg-[#1E3A5F] text-white px-4 py-3 flex justify-between items-center shadow-md sticky top-0 z-50">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🎓</span>
          <span className="font-bold text-lg tracking-tight">QR Katılım</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/student/profile')}
            className="p-1.5 rounded-lg hover:bg-[#163050] transition-colors relative"
            title="Profil"
          >
            <UserCircle className="w-5 h-5" />
            {!hasAvatar && (
              <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border border-[#1E3A5F]" />
            )}
          </button>
          <span className="text-sm font-medium text-gray-200 max-w-[100px] truncate">
            {user?.name}
          </span>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-lg hover:bg-[#163050] transition-colors"
            title="Çıkış Yap"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Dashboard Content */}
      <main className="flex-1 p-4 space-y-6 max-w-3xl mx-auto w-full">

        {/* Avatar Warning Banner */}
        {!hasAvatar && (
          <button
            onClick={() => navigate('/student/profile')}
            className="w-full bg-red-50 border border-red-200 rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:bg-red-100 transition-colors"
          >
            <AlertTriangle className="w-6 h-6 text-red-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-red-800">Profil Fotoğrafı Yükleyin</p>
              <p className="text-xs text-red-600">Yoklamaya katılmak için profil fotoğrafınızı yüklemeniz gerekiyor.</p>
            </div>
          </button>
        )}

        {/* Active Session Banner */}
        {relevantActiveSessions.length > 0 ? (
          <div className="bg-green-50 border border-green-200 rounded-2xl p-4 shadow-sm animate-pulse">
            <div className="flex flex-col items-center text-center space-y-3">
              <div className="flex items-center gap-2 text-green-800 font-semibold text-lg">
                <span className="text-xl">📱</span>
                <span>Yoklama Açık: {relevantActiveSessions[0].course_name}</span>
              </div>
              <Button
                variant="primary"
                className="w-full py-3.5 bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2 text-base font-bold rounded-xl shadow-md hover:scale-[1.02] transition-all duration-200"
                onClick={() => navigate('/student/scan')}
              >
                <Scan className="w-5 h-5" />
                QR Tara
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-4 text-gray-500 bg-white border border-gray-100 rounded-2xl text-sm shadow-sm">
            📭 Şu an açık bir yoklama oturumu bulunmuyor.
          </div>
        )}

        {/* Course List */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-gray-600" />
            Derslerim
          </h2>

          {myAttendances.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              Herhangi bir derse kaydınız bulunmamaktadır.
            </div>
          ) : (
            <div className="grid gap-4">
              {myAttendances.map((course) => {
                const percent = course.attendance_percentage || 0;

                let progressColor = 'bg-red-500';
                if (percent >= 70) progressColor = 'bg-green-500';
                else if (percent >= 60) progressColor = 'bg-yellow-500';

                return (
                  <Card key={course.course_id} className="p-4 shadow-sm border-gray-100 rounded-2xl hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-bold text-gray-900 text-base leading-snug">
                          {course.course_name}
                        </h3>
                        <p className="text-xs text-gray-500 mt-0.5 font-mono">
                          {course.course_code}
                        </p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded-lg ${percent >= 70 ? 'bg-green-50 text-green-700' :
                          percent >= 60 ? 'bg-yellow-50 text-yellow-700' :
                            'bg-red-50 text-red-700'
                        }`}>
                        %{percent}
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full bg-gray-100 rounded-full h-2.5 mb-2 overflow-hidden">
                      <div
                        className={`h-full rounded-full ${progressColor} transition-all duration-500`}
                        style={{ width: `${percent}%` }}
                      />
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-600">
                      <span>Katılım Durumu</span>
                      <span className="font-medium">
                        {course.attended} / {course.total_sessions} ders
                      </span>
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
