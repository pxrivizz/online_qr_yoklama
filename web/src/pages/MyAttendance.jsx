import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { attendanceAPI } from '../api/attendanceAPI';

export const MyAttendance = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['myAttendances'],
    queryFn: attendanceAPI.getMyAttendances,
  });

  const courseAttendances = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : data.attendances || [];
  }, [data]);

  const totalCourses = courseAttendances.length;
  const attendedCourses = courseAttendances.filter((course) => (course.attended || 0) > 0).length;
  const absentCourses = Math.max(totalCourses - attendedCourses, 0);
  const averageAttendance = totalCourses
    ? Math.round(
        courseAttendances.reduce((sum, course) => sum + Number(course.attendance_percentage || 0), 0) /
          totalCourses
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Benim Yoklamam</h1>
          <p className="text-gray-600 mt-1">Derslerinize katılım bilgilerinizi görebilirsiniz</p>
        </div>
        <Button variant="primary" size="md" className="gap-2">
          <Download size={18} />
          Rapor İndir
        </Button>
      </div>

      {isLoading && <div className="text-sm text-gray-500">Yoklama verileri yükleniyor...</div>}

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Toplam Dersler</p>
              <p className="text-3xl font-bold text-gray-900">{totalCourses}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50">
              <TrendingUp size={24} className="text-blue-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Katıldığım Dersler</p>
              <p className="text-3xl font-bold text-green-600">{attendedCourses}</p>
              <p className="text-xs text-gray-500 mt-1">{averageAttendance}%</p>
            </div>
            <div className="p-3 rounded-lg bg-green-50">
              <div className="text-2xl">✓</div>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Devamsızlıklar</p>
              <p className="text-3xl font-bold text-red-600">{absentCourses}</p>
              <p className="text-xs text-gray-500 mt-1">{Math.max(100 - averageAttendance, 0)}%</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50">
              <div className="text-2xl">✕</div>
            </div>
          </div>
        </Card>
      </div>

      {/* Courses Breakdown */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Derslere Göre Yoklama Detayları</h2>
        <div className="space-y-4">
          {courseAttendances.length === 0 ? (
            <Card>
              <p className="text-sm text-gray-500">Henüz ders kaydı bulunamadı.</p>
            </Card>
          ) : (
            courseAttendances.map((course) => {
              const percentage = Number(course.attendance_percentage || 0);
              const attended = Number(course.attended || 0);
              const total = Number(course.total_sessions || 0);

              return (
                <Card key={course.course_id}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900">{course.course_name}</h3>
                      <p className="text-sm text-gray-600">{course.course_code}</p>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${getPercentageColor(percentage)}`}>
                        {percentage}%
                      </div>
                      <p className="text-xs text-gray-500">{attended}/{total}</p>
                    </div>
                  </div>

                  <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(percentage)}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 pt-3 border-t border-gray-100">
                    <div>
                      <span className="text-green-600 font-semibold">{attended}</span>
                      {' '}Katıldı
                    </div>
                    <div>
                      <span className="text-red-600 font-semibold">{Math.max(total - attended, 0)}</span>
                      {' '}Devamsız
                    </div>
                    <div className="text-right">
                      <span className="font-semibold">{total}</span>
                      {' '}Toplam
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* Legend */}
      <Card className="bg-gradient-to-r from-green-50 to-blue-50">
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded-full" />
            <span>70% ve üzeri - İyi</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded-full" />
            <span>60-70% - Orta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded-full" />
            <span>60% altı - Düşük</span>
          </div>
        </div>
      </Card>
    </div>
  );
};

const getPercentageColor = (percentage) => {
  if (percentage >= 70) return 'text-green-600';
  if (percentage >= 60) return 'text-yellow-600';
  return 'text-red-600';
};

const getProgressColor = (percentage) => {
  if (percentage >= 70) return 'bg-green-500';
  if (percentage >= 60) return 'bg-yellow-500';
  return 'bg-red-500';
};

