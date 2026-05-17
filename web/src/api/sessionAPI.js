import api from './axios';

export const sessionAPI = {
  startSession: (courseId, sessionNumber) => {
    if (sessionNumber) {
      return api.post(`/api/courses/${courseId}/sessions/${sessionNumber}/generate`).then((res) => res.data);
    }
    return api.post('/api/sessions/start', { course_id: courseId }).then((res) => res.data);
  },

  getActiveSessions: () =>
    api.get('/api/sessions/active').then((res) => {
      const data = res.data;
      return Array.isArray(data) ? data : data.sessions || [];
    }),

  getSessionById: (id) =>
    api.get(`/api/sessions/${id}`).then((res) => res.data),

  refreshQRToken: (id) =>
    api.put(`/api/sessions/${id}/refresh-qr`).then((res) => res.data),

  endSession: (id) =>
    api.put(`/api/sessions/${id}/end`).then((res) => res.data),

  getSessionAttendances: (id) =>
    api.get(`/api/sessions/${id}/attendances`).then((res) => res.data),

  getCourseSessions: (courseId) =>
    api.get(`/api/sessions/course/${courseId}`).then((res) => res.data),
};
