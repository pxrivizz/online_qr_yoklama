import api from './axios';

export const attendanceAPI = {
  getAttendanceGrid: (courseId) =>
    api.get(`/api/attendance/grid/${courseId}`),

  toggleAttendance: (studentId, courseId, attendanceIndex) =>
    api.post('/api/attendance/toggle', { student_id: studentId, course_id: courseId, attendance_index: attendanceIndex }),

  getMyAttendances: () =>
    api.get('/api/attendance/my').then((res) => {
      const data = res.data;
      return Array.isArray(data) ? data : data.attendances || [];
    }),

  getAttendanceSummary: (courseId) =>
    api.get(`/api/attendance/summary/${courseId}`),

  markAttendance: (qrToken, latitude, longitude) =>
    api.post('/api/attendance/mark', { qr_token: qrToken, latitude, longitude }),

  exportAttendance: (sessionId) =>
    api.get(`/api/attendance/export/${sessionId}`, { responseType: 'blob' }),

  importFromExcel: (courseId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post(`/api/attendance/import/${courseId}`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  markManual: (sessionId, studentIds) =>
    api.post('/api/attendance/manual', { session_id: sessionId, student_ids: studentIds }),
};
