import api from './axios';

export const courseAPI = {
  getCourses: () =>
    api.get('/api/courses').then((res) => res.data),

  getCourseById: (id) =>
    api.get(`/api/courses/${id}`),

  createCourse: (data) =>
    api.post('/api/courses', data),

  updateCourse: (id, data) =>
    api.put(`/api/courses/${id}`, data).then((res) => res.data),

  deleteCourse: (id) =>
    api.delete(`/api/courses/${id}`).then((res) => res.data),

  enrollStudents: (id, studentIds) =>
    api.post(`/api/courses/${id}/enroll`, { student_ids: studentIds }),

  getCourseStudents: (id) =>
    api.get(`/api/courses/${id}/students`),

  exportAttendance: (id) =>
    api.get(`/api/courses/${id}/export-attendance`, { responseType: 'blob' }),

  importCourseStudents: (id, students) =>
    api.post(`/api/courses/${id}/import-students`, { students }),
};
