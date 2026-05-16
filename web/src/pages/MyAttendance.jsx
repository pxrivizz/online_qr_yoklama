import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, TrendingUp, CheckCircle2, XCircle } from 'lucide-react';
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
    ? Math.round(courseAttendances.reduce((sum, course) => sum + Number(course.attendance_percentage || 0), 0) / totalCourses)
    : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="animate-slide-up">
          <h1 className="page-title">Benim Yoklamam</h1>
          <p className="page-subtitle">Derslerinize katılım bilgilerinizi görebilirsiniz</p>
        </div>
        <Button variant="primary" size="md" className="gap-2">
          <Download size={16} />
          Rapor İndir
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-emerald-500 border-t-transparent" />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Toplam Dersler</p>
              <p className="text-3xl font-extrabold text-slate-900">{totalCourses}</p>
            </div>
            <div className="p-3 rounded-xl bg-sky-50"><TrendingUp size={22} className="text-sky-600" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Katıldığım Dersler</p>
              <p className="text-3xl font-extrabold text-emerald-600">{attendedCourses}</p>
              <p className="text-xs text-slate-400 mt-0.5">{averageAttendance}%</p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50"><CheckCircle2 size={22} className="text-emerald-600" /></div>
          </div>
        </Card>
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Devamsızlıklar</p>
              <p className="text-3xl font-extrabold text-rose-600">{absentCourses}</p>
              <p className="text-xs text-slate-400 mt-0.5">{Math.max(100 - averageAttendance, 0)}%</p>
            </div>
            <div className="p-3 rounded-xl bg-rose-50"><XCircle size={22} className="text-rose-500" /></div>
          </div>
        </Card>
      </div>

      <div>
        <h2 className="section-title mb-5">Derslere Göre Yoklama Detayları</h2>
        <div className="space-y-4">
          {courseAttendances.length === 0 ? (
            <Card className="text-center py-10">
              <p className="text-sm text-slate-500">Henüz ders kaydı bulunamadı.</p>
            </Card>
          ) : (
            courseAttendances.map((course) => {
              const percentage = Number(course.attendance_percentage || 0);
              const attended = Number(course.attended || 0);
              const total = Number(course.total_sessions || 0);
              return (
                <Card key={course.course_id}>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-base font-bold text-slate-900 truncate">{course.course_name}</h3>
                      <p className="text-xs text-slate-500 font-mono">{course.course_code}</p>
                    </div>
                    <div className="text-right ml-4">
                      <div className={`text-2xl font-extrabold ${percentage >= 70 ? 'text-emerald-600' : percentage >= 60 ? 'text-amber-600' : 'text-rose-600'}`}>{percentage}%</div>
                      <p className="text-xs text-slate-400">{attended}/{total}</p>
                    </div>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-2.5 mb-4">
                    <div className={`h-2.5 rounded-full transition-all duration-500 ${percentage >= 70 ? 'bg-emerald-500' : percentage >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${percentage}%` }} />
                  </div>
                  <div className="grid grid-cols-3 gap-4 text-xs text-slate-500 pt-3 border-t border-slate-100">
                    <div><span className="font-semibold text-emerald-600">{attended}</span> Katıldı</div>
                    <div><span className="font-semibold text-rose-600">{Math.max(total - attended, 0)}</span> Devamsız</div>
                    <div className="text-right"><span className="font-semibold text-slate-700">{total}</span> Toplam</div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>

      <Card className="bg-gradient-to-r from-emerald-50 via-sky-50 to-violet-50 !border-emerald-100">
        <div className="flex flex-wrap items-center gap-5 text-sm">
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-emerald-500 rounded-full" /><span className="text-slate-600">70% ve üzeri - İyi</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-amber-500 rounded-full" /><span className="text-slate-600">60-70% - Orta</span></div>
          <div className="flex items-center gap-2"><div className="w-3 h-3 bg-rose-500 rounded-full" /><span className="text-slate-600">60% altı - Düşük</span></div>
        </div>
      </Card>
    </div>
  );
};
