import api from './axios';

export const userAPI = {
  getUsers: (role) =>
    api.get('/api/users', { params: role ? { role } : undefined }),

  createUser: (data) =>
    api.post('/api/users', data),

  updateUser: (id, data) =>
    api.put(`/api/users/${id}`, data),

  deleteUser: (id) =>
    api.delete(`/api/users/${id}`),

  bulkDeleteUsers: async (ids) => {
    const results = await Promise.allSettled(ids.map((id) => api.delete(`/api/users/${id}`)));
    const deleted = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.length - deleted;
    return { deleted, failed, results };
  },

  bulkCreateStudents: (students) =>
    api.post('/api/users/bulk', { students }),

  uploadAvatar: (file) => {
    const formData = new FormData();
    formData.append('avatar', file);
    return api.post('/api/users/avatar', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

