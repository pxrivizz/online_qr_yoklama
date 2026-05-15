import { Download, TrendingUp } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';

export const MyAttendance = () => {
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

      {/* Overall Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-2">Toplam Dersler</p>
              <p className="text-3xl font-bold text-gray-900">32</p>
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
              <p className="text-3xl font-bold text-green-600">27</p>
              <p className="text-xs text-gray-500 mt-1">84.4%</p>
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
              <p className="text-3xl font-bold text-red-600">5</p>
              <p className="text-xs text-gray-500 mt-1">15.6%</p>
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
          {courseAttendances.map((course) => (
            <Card key={course.id}>
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900">{course.name}</h3>
                  <p className="text-sm text-gray-600">{course.code}</p>
                </div>
                <div className="text-right">
                  <div className={`text-2xl font-bold ${getPercentageColor(course.percentage)}`}>
                    {course.percentage}%
                  </div>
                  <p className="text-xs text-gray-500">{course.attended}/{course.total}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${getProgressColor(course.percentage)}`}
                  style={{ width: `${course.percentage}%` }}
                />
              </div>

              {/* Details */}
              <div className="grid grid-cols-3 gap-4 text-xs text-gray-600 pt-3 border-t border-gray-100">
                <div>
                  <span className="text-green-600 font-semibold">{course.attended}</span>
                  {' '}Katıldı
                </div>
                <div>
                  <span className="text-red-600 font-semibold">{course.total - course.attended}</span>
                  {' '}Devamsız
                </div>
                <div className="text-right">
                  <span className="font-semibold">{course.total}</span>
                  {' '}Toplam
                </div>
              </div>
            </Card>
          ))}
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

const courseAttendances = [
  { id: 1, name: 'Yazılım Mimarisi', code: 'CS301', attended: 9, total: 10, percentage: 90 },
  { id: 2, name: 'Veri Tabanları', code: 'CS302', attended: 8, total: 10, percentage: 80 },
  { id: 3, name: 'Web Geliştirme', code: 'CS303', attended: 6, total: 10, percentage: 60 },
  { id: 4, name: 'Mobil Programlama', code: 'CS304', attended: 4, total: 9, percentage: 44 },
  { id: 5, name: 'İşletim Sistemleri', code: 'CS305', attended: 7, total: 10, percentage: 70 },
  { id: 6, name: 'Bilgisayar Ağları', code: 'CS306', attended: 8, total: 10, percentage: 80 },
];
