import api from './axios';

export const authAPI = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }).then((res) => res.data),

  getMe: () =>
    api.get('/api/auth/me'),
};
