import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { Users, Clock, MapPin, Edit2, Trash2, Play, CheckCircle2 } from 'lucide-react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { QRCodeSVG } from 'qrcode.react';
import { sessionAPI } from '../api/sessionAPI';
import { courseAPI } from '../api/courseAPI';
import { attendanceAPI } from '../api/attendanceAPI';
import { importAPI } from '../api/importAPI';

export const CourseDetail = () => {
  const { id } = useParams();
  const queryClient = useQueryClient();

  const [isQrModalOpen, setIsQrModalOpen] = useState(false);
  const [qrSession, setQrSession] = useState(null);
  const [timeLeft, setTimeLeft] = useState(0);
  const [isStartingSession, setIsStartingSession] = useState(false);
  const [isEndingSession, setIsEndingSession] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState('students');

  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [selectedPastSession, setSelectedPastSession] = useState(null);
  const [sessionAttendances, setSessionAttendances] = useState([]);
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  const [manualSelectedStudents, setManualSelectedStudents] = useState([]);
  const [isManualSubmitting, setIsManualSubmitting] = useState(false);

  const { data: courseSessions, refetch: refetchSessions } = useQuery({
    queryKey: ['courseSessions', id],
    queryFn: () => sessionAPI.getCourseSessions(id),
    enabled: true
  });

  const handleExportExcel = async () => {
    setIsExporting(true);
    try {
      const response = await courseAPI.exportAttendance(id);
      const blob = response.data || response;

      const url = window.URL.createObjectURL(new Blob([blob]));
      const link = document.createElement('a');
      link.href = url;
      const today = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
      const courseName = courseData?.course_name || courseData?.name || 'Ders';
      link.setAttribute('download', `${courseName}_Yoklama_${today}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();

      toast.success('Excel dosyası indirildi!');
    } catch (error) {
      console.error('Excel export error:', error);
      toast.error('Dışarı aktarma başarısız oldu');
    } finally {
      setIsExporting(false);
    }
  };

  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [parsedImportStudents, setParsedImportStudents] = useState([]);
  const [isImporting, setIsImporting] = useState(false);

  const handleImportExcel = async (file) => {
    try {
      const parsed = await importAPI.parseEnrollmentExcel(file);
      const mapped = parsed.students.map((student) => ({
        student_number: student.student_number,
        name: student.full_name,
      }));

      setParsedImportStudents(mapped);
      if (mapped.length === 0) {
        toast.error('Dosyada geçerli öğrenci verisi bulunamadı');
      }
    } catch (error) {
      console.error('Excel parsing error:', error);
      toast.error('Dosya okunamadı');
    }
  };

  const handleImportSubmit = async () => {
    if (parsedImportStudents.length === 0) {
      toast.error('Yüklenecek öğrenci yok');
      return;
    }

    setIsImporting(true);
    try {
      await courseAPI.importCourseStudents(id, parsedImportStudents);
      toast.success(`${parsedImportStudents.length} öğrenci başarıyla içe aktarıldı!`);
      queryClient.invalidateQueries({ queryKey: ['courseStudents', id] });
      setIsImportOpen(false);
      setImportFile(null);
      setParsedImportStudents([]);
    } catch (error) {
      console.error('Student import error:', error);
      toast.error('İçe aktarma sırasında hata oluştu');
    } finally {
      setIsImporting(false);
    }
  };

  const { data: courseData, isLoading: isCourseLoading } = useQuery({
    queryKey: ['course', id],
    queryFn: () => courseAPI.getCourseById(id).then((res) => res.data),
  });

  const { data: studentsData } = useQuery({
    queryKey: ['courseStudents', id],
    queryFn: () => courseAPI.getCourseStudents(id).then((res) => res.data),
  });

  const { data: activeSessionsData } = useQuery({
    queryKey: ['activeSessions'],
    queryFn: sessionAPI.getActiveSessions,
  });

  const { data: gridData, isLoading: isGridLoading } = useQuery({
    queryKey: ['attendanceGrid', id],
    queryFn: () => attendanceAPI.getAttendanceGrid(id).then((res) => res.data),
  });

  const totalPlanned = gridData?.total_sessions_planned || 0;
  const sessionColumns = Array.from({ length: totalPlanned }, (_, i) => i + 1);

  const handleToggleAttendance = async (studentId, index) => {
    try {
      await attendanceAPI.toggleAttendance(studentId, id, index);
      queryClient.invalidateQueries({ queryKey: ['attendanceGrid', id] });
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const handleExcelExport = async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Yoklama');

    const students = gridData?.students || [];
    const courseId = id;

    // Header row
    const headers = ['Öğrenci Adı', 'Öğrenci No', 'Durum'];
    for (let i = 1; i <= totalPlanned; i++) {
      headers.push(`Ders ${i}`);
    }
    headers.push('Toplam Katılım', 'Katılım Yüzdesi');

    const headerRow = worksheet.addRow(headers);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E3A5F' }
    };

    // Data rows
    students.forEach((student) => {
      const attended = student.manual_indexes || [];
      const totalAttended = attended.length;
      const percentage = totalPlanned > 0
        ? Math.round((totalAttended / totalPlanned) * 100)
        : 0;

      const row = [
        student.name,
        student.student_number,
        student.is_mandatory ? 'Zorunlu' : 'Alttan'
      ];

      for (let i = 1; i <= totalPlanned; i++) {
        row.push(attended.includes(i) ? '✓' : '');
      }

      row.push(`${totalAttended} / ${totalPlanned}`, `%${percentage}`);
      const dataRow = worksheet.addRow(row);

      // Yellow background for alttan students
      if (!student.is_mandatory) {
        dataRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFF9C4' }
        };
      }
    });

    // Auto column widths
    worksheet.columns.forEach((col) => {
      col.width = 15;
    });
    worksheet.getColumn(1).width = 30; // name
    worksheet.getColumn(2).width = 15; // student number

    // Download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const today = new Date().toLocaleDateString('tr-TR').replace(/\./g, '-');
    const courseName = course?.name || course?.code || 'Ders';
    a.download = `${courseName}_Yoklama_${today}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const course = useMemo(() => {
    if (!courseData) return null;
    return courseData.course || courseData;
  }, [courseData]);

  const students = useMemo(() => {
    if (!studentsData) return [];
    return Array.isArray(studentsData) ? studentsData : studentsData.students || [];
  }, [studentsData]);

  const activeSessions = useMemo(() => {
    if (!activeSessionsData) return [];
    return Array.isArray(activeSessionsData)
      ? activeSessionsData
      : activeSessionsData.sessions || [];
  }, [activeSessionsData]);

  const activeSession = useMemo(() => {
    return activeSessions.find((session) => session.course_id === id);
  }, [activeSessions, id]);

  const isActive = Boolean(activeSession);

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

  const handleStartSession = async () => {
    setIsStartingSession(true);
    try {
      const response = await sessionAPI.startSession(id);
      const payload = response?.data ?? response;
      setQrSession(payload);
      setIsQrModalOpen(true);
      toast.success('Yoklama başlatıldı!');
      queryClient.invalidateQueries({ queryKey: ['activeSessions'] });
    } catch (error) {
      console.error('Hata:', error);
      toast.error(error?.response?.data?.error || error?.response?.data?.message || 'Yoklama başlatılamadı');
    } finally {
      setIsStartingSession(false);
    }
  };

  const handleEndSession = async () => {
    const sessionId = activeSession?.id || qrSession?.id;
    if (!sessionId) {
      toast.error('Aktif oturum bulunamadı');
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

  const handleCloseQrModal = () => {
    if (isEndingSession || isStartingSession) return;
    setIsQrModalOpen(false);
  };

  const columns = [
    { key: 'name', label: 'Öğrenci Adı', render: (row) => row.name || `${row.first_name} ${row.last_name}` },
    { key: 'student_number', label: 'Öğrenci No' },
    {
      key: 'attendance',
      label: 'Katılım',
      render: (row) => {
        const attended = Number(row.attended_count ?? row.attended ?? 0);
        const total = Number(course?.total_sessions_planned ?? 0);
        const percent = total > 0 ? Math.round((attended / total) * 100) : 0;
        return (
          <div className="flex items-center gap-2">
            <div className="flex-1 bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${percent >= 70 ? 'bg-emerald-500' : percent >= 60 ? 'bg-amber-500' : 'bg-rose-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="text-xs">
              <div className="font-semibold">{percent}%</div>
              <div className="text-[11px] text-slate-500">{attended} / {total} derse katıldı</div>
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="space-y-6">
      {/* Course Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="animate-slide-up">
          <h1 className="page-title">
            {isCourseLoading ? 'Yükleniyor...' : course?.name || 'Ders'}
          </h1>
          <div className="flex items-center gap-4 text-slate-500 mt-1">
            <span className="text-base font-semibold font-mono">{course?.code}</span>
            <span className="flex items-center gap-1.5 text-sm">
              <Users size={15} />
              {course?.student_count || students.length || '0'} Öğrenci
            </span>
          </div>
        </div>
        <div className="flex gap-3">
          {isActive ? (
            <>
              <Button
                variant="primary"
                size="md"
                className="gap-2"
                onClick={() => {
                  setQrSession(activeSession);
                  setIsQrModalOpen(true);
                }}
              >
                <CheckCircle2 size={18} />
                QR Kodu
              </Button>
              <Button
                variant="danger"
                size="md"
                className="gap-2"
                onClick={handleEndSession}
                loading={isEndingSession}
              >
                Oturumu Bitir
              </Button>
            </>
          ) : (
            <Button
              variant="primary"
              size="md"
              className="gap-2"
              onClick={handleStartSession}
              loading={isStartingSession}
            >
              <Play size={18} />
              Yoklama Başlat
            </Button>
          )}
        </div>
      </div>

      {/* Course Info */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Ders Kodu</p>
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{course?.code || '-'}</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-50"><span className="text-xl">📚</span></div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Toplam Öğrenci</p>
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight">
                {course?.student_count || students.length || '0'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-sky-50">
              <Users size={22} className="text-sky-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">İzin Verilen Ağ</p>
              <p className="text-sm font-mono text-slate-900">
                {course?.allowed_ip_range || course?.allowed_ssid || 'Tümü'}
              </p>
            </div>
            <div className="p-3 rounded-xl bg-emerald-50">
              <MapPin size={22} className="text-emerald-600" />
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm font-medium text-slate-500 mb-1">Planlanan Yoklama</p>
              <p className="text-2xl font-extrabold text-slate-900 tracking-tight">{course?.total_sessions_planned ?? 0}</p>
            </div>
            <div className="p-3 rounded-xl bg-amber-50"><span className="text-xl">📆</span></div>
          </div>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-1">
        <button
          onClick={() => setActiveTab('students')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${activeTab === 'students'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
        >
          Öğrenci Listesi
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`px-4 py-3 text-sm font-semibold border-b-2 transition-all duration-200 ${activeTab === 'history'
              ? 'border-emerald-500 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
            }`}
        >
          Yoklama Geçmişi
        </button>
      </div>

      {activeTab === 'students' ? (
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center mb-6">
            <h2 className="section-title">Öğrenci Listesi & Yoklama</h2>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                size="sm"
                className="gap-2"
                onClick={() => setIsImportOpen(true)}
              >
                📥 Excel'den Aktar
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="gap-2 bg-emerald-50 hover:bg-emerald-100 border-emerald-200 text-emerald-700"
                onClick={handleExcelExport}
              >
                📄 Excel'e Aktar
              </Button>
            </div>
          </div>

          {/* Legend */}
          <div className="flex flex-wrap items-center gap-5 text-sm p-4 bg-slate-50 rounded-xl border border-slate-100 mb-6">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-emerald-500 inline-flex items-center justify-center text-white text-[9px] font-bold">✓</div>
              <span className="text-slate-600 font-medium">QR / Manuel katılım</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-slate-200 inline-block" />
              <span className="text-slate-600 font-medium">Katılmadı</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-amber-100 border border-amber-300 inline-block" />
              <span className="text-slate-600 font-medium">Alttan alan öğrenci</span>
            </div>
          </div>

          {isGridLoading ? (
            <div className="text-center py-8 text-slate-400">Yoklama tablosu yükleniyor...</div>
          ) : !gridData || !gridData.students || gridData.students.length === 0 ? (
            <div className="text-center py-8 text-slate-400">Hiç öğrenci bulunamadı</div>
          ) : totalPlanned === 0 ? (
            <div className="text-amber-700 bg-amber-50 p-4 rounded-xl text-sm border border-amber-200">
              ⚠️ Bu ders için henüz yoklama sayısı belirlenmemiş. Dersi düzenleyerek toplam yoklama sayısını girin.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="sticky left-0 bg-slate-50 px-5 py-3.5 text-left font-semibold z-10 border-r border-slate-200 min-w-[180px]">
                      Öğrenci Adı
                    </th>
                    <th className="px-5 py-3.5 text-left font-semibold min-w-[120px]">Öğrenci No</th>
                    {sessionColumns.map((index) => (
                      <th key={index} className="px-2 py-3 text-center text-xs font-semibold text-slate-500 w-8">
                        {index}
                      </th>
                    ))}
                    <th className="px-5 py-3.5 text-center font-semibold border-l border-slate-200 min-w-[140px]">
                      Toplam / Yüzde
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white text-sm text-slate-800">
                  {gridData?.students?.map((student) => {
                    const totalAttended = student.manual_indexes?.length || 0;
                    const percentage = totalPlanned > 0 ? Math.round((totalAttended / totalPlanned) * 100) : 0;

                    let percentColor = 'text-rose-600 font-bold';
                    if (percentage >= 70) {
                      percentColor = 'text-emerald-600 font-bold';
                    } else if (percentage >= 60) {
                      percentColor = 'text-amber-600 font-bold';
                    }

                    return (
                      <tr key={student.id} className={student.is_mandatory ? 'bg-white hover:bg-slate-50/50' : 'bg-amber-50/50 hover:bg-amber-50'}>
                        <td className="px-4 py-3 sticky left-0 bg-white border-r border-slate-200 z-10">
                          <div className="flex items-center gap-3">
                            {student.avatar_url ? (
                              <img
                                src={`http://localhost:3000${student.avatar_url}`}
                                alt={student.name}
                                className="w-8 h-8 rounded-xl object-cover flex-shrink-0"
                              />
                            ) : (
                              <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs text-slate-500 font-bold">
                                  {student.name?.charAt(0)}
                                </span>
                              </div>
                            )}
                            <div>
                              <span className="font-medium text-slate-900 text-sm truncate">{student.name}</span>
                              {!student.is_mandatory && (
                                <span className="ml-2 text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-md font-semibold">Alttan</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4 whitespace-nowrap text-slate-500 font-mono text-xs">{student.student_number}</td>

                        {sessionColumns.map((index) => {
                          const attended = student.manual_indexes?.includes(index);
                          return (
                            <td key={index} className="px-2 py-3 text-center">
                              <button
                                type="button"
                                onClick={() => handleToggleAttendance(student.id, index)}
                                className={`w-7 h-7 rounded-full border-2 transition-all duration-200 hover:scale-110 ${attended
                                    ? 'bg-emerald-500 border-emerald-500 text-white'
                                    : 'bg-white border-slate-300 hover:border-emerald-400'
                                  }`}
                              >
                                {attended && <span className="text-xs">✓</span>}
                              </button>
                            </td>
                          );
                        })}

                        <td className="px-5 py-4 text-center whitespace-nowrap font-medium border-l border-slate-200">
                          <div className="text-slate-800 font-semibold">{totalAttended} / {totalPlanned}</div>
                          <div className={percentColor}>%{percentage}</div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      ) : (
        <Card>
          <div className="flex justify-between items-center mb-6">
            <h2 className="section-title">Geçmiş Yoklama Oturumları</h2>
          </div>
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200 text-sm text-left">
              <thead className="bg-slate-50 text-slate-600 text-xs font-semibold uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3.5">Başlangıç Tarihi</th>
                  <th className="px-5 py-3.5">Durum</th>
                  <th className="px-5 py-3.5">Katılım</th>
                  <th className="px-5 py-3.5 text-right">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-800">
                {courseSessions?.map((session) => (
                  <tr key={session.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-4">
                      {new Date(session.started_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-5 py-4">
                      {session.is_active ? (
                        <span className="badge-success">Aktif</span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">Tamamlandı</span>
                      )}
                    </td>
                    <td className="px-5 py-4 font-medium">
                      {session.attendance_count || 0} Öğrenci
                    </td>
                    <td className="px-5 py-4 text-right">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={async () => {
                          setSelectedPastSession(session);
                          try {
                            const atts = await sessionAPI.getSessionAttendances(session.id);
                            setSessionAttendances(atts || []);
                            setManualSelectedStudents([]);
                            setIsManualModalOpen(true);
                          } catch (e) {
                            toast.error('Yoklama bilgileri alınamadı');
                          }
                        }}
                      >
                        Manuel Yoklama
                      </Button>
                    </td>
                  </tr>
                ))}
                {(!courseSessions || courseSessions.length === 0) && (
                  <tr>
                    <td colSpan="4" className="text-center py-8 text-slate-400">
                      Hiç yoklama oturumu bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Manual Attendance Modal for Past Session */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Manuel Yoklama Ekle"
        size="lg"
      >
        <div className="space-y-4">
          <div>
            <input
              type="text"
              placeholder="Öğrenci adı veya numarası ile filtrele..."
              value={manualSearchQuery}
              onChange={(e) => setManualSearchQuery(e.target.value)}
              className="input"
            />
          </div>

          <div className="max-h-[400px] overflow-y-auto space-y-1 divide-y divide-slate-100">
            {students
              .filter(student =>
                (student.name || '').toLowerCase().includes(manualSearchQuery.toLowerCase()) ||
                (student.student_number || '').toLowerCase().includes(manualSearchQuery.toLowerCase())
              )
              .map((student) => {
                const present = sessionAttendances.some(att => att.student_id === student.id && att.is_valid);
                const selected = manualSelectedStudents.includes(student.id);

                return (
                  <div key={student.id} className="flex items-center justify-between py-3 px-3 rounded-xl hover:bg-slate-50 transition-colors first:pt-3">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <input
                        type="checkbox"
                        id={`past-student-${student.id}`}
                        checked={present || selected}
                        disabled={present}
                        onChange={() => {
                          setManualSelectedStudents(prev =>
                            prev.includes(student.id)
                              ? prev.filter(id => id !== student.id)
                              : [...prev, student.id]
                          );
                        }}
                        className="rounded-md text-emerald-600 focus:ring-emerald-500 disabled:bg-slate-200 h-4 w-4 cursor-pointer disabled:cursor-not-allowed"
                      />
                      <label
                        htmlFor={`past-student-${student.id}`}
                        className={`text-sm font-medium truncate ${present ? 'text-slate-400' : 'text-slate-800 cursor-pointer'}`}
                      >
                        {student.name} <span className="text-slate-400 font-normal">({student.student_number || '-'})</span>
                      </label>
                    </div>
                    {present && (
                      <span className="badge-success text-xs ml-2">✓ Mevcut</span>
                    )}
                  </div>
                );
              })}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button variant="secondary" type="button" onClick={() => setIsManualModalOpen(false)}>
              İptal
            </Button>
            <Button
              variant="primary"
              type="button"
              className="bg-emerald-600 hover:bg-emerald-700 text-white border-none"
              onClick={async () => {
                if (manualSelectedStudents.length === 0) {
                  toast.error('Lütfen öğrenci seçin');
                  return;
                }
                setIsManualSubmitting(true);
                try {
                  await attendanceAPI.markManual(selectedPastSession.id, manualSelectedStudents);
                  toast.success(`${manualSelectedStudents.length} öğrenci yoklamaya eklendi`);
                  setIsManualModalOpen(false);
                  setManualSelectedStudents([]);
                  refetchSessions();
                  queryClient.invalidateQueries({ queryKey: ['courseStudents', id] });
                } catch (error) {
                  console.error('Manual attendance error:', error);
                  toast.error('Manuel yoklama ekleme başarısız');
                } finally {
                  setIsManualSubmitting(false);
                }
              }}
              loading={isManualSubmitting}
              disabled={manualSelectedStudents.length === 0}
            >
              Seçilenleri İşaretle
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Modal */}
      <Modal isOpen={isQrModalOpen} onClose={handleCloseQrModal} title="Yoklama QR Kodu" size="lg">
        <div className="space-y-4">
          {course && (
            <div className="text-center mb-4">
              <h3 className="text-xl font-bold text-slate-900">{course.name}</h3>
              <p className="text-sm text-slate-500 font-mono">{course.code}</p>
            </div>
          )}

          {qrSession ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-slate-100 bg-slate-50 p-6">
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
            <div className="text-sm text-slate-400 text-center py-8">Yoklama oturumu yükleniyor...</div>
          )}

          <div className="flex justify-end gap-3">
            <Button variant="secondary" type="button" onClick={handleCloseQrModal} disabled={isEndingSession}>
              Kapat
            </Button>
            {qrSession && (
              <Button
                variant="danger"
                type="button"
                onClick={handleEndSession}
                loading={isEndingSession}
              >
                Oturumu Sonlandır
              </Button>
            )}
          </div>
        </div>
      </Modal>

      {/* Excel Import Modal */}
      <Modal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} title="Excel'den Öğrenci İçe Aktar">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">
            Öğrencileri ders listenizden toplu şekilde yüklemek için Excel (.xlsx) formatındaki dosyanızı seçin.
          </p>

          <input
            type="file"
            accept=".xlsx"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setImportFile(file || null);
              setParsedImportStudents([]);
              if (file) handleImportExcel(file);
            }}
            className="w-full text-sm text-slate-600 file:mr-4 file:rounded-xl file:border-0 file:bg-slate-100 file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200 file:transition-colors file:cursor-pointer"
          />

          <div className="rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-slate-600">
            {parsedImportStudents.length > 0 ? (
              <span className="text-emerald-600 font-medium">
                ✓ {parsedImportStudents.length} geçerli öğrenci okundu.
              </span>
            ) : importFile ? (
              <span className="text-amber-600">Dosya okunuyor / geçersiz veri...</span>
            ) : (
              'Henüz dosya seçilmedi.'
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsImportOpen(false)}>
              İptal
            </Button>
            <Button
              variant="primary"
              type="button"
              onClick={handleImportSubmit}
              loading={isImporting}
              disabled={parsedImportStudents.length === 0}
            >
              Öğrencileri Ekle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
