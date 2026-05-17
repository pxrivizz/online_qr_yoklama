import api from './axios';

export const authAPI = {
  login: (email, password) =>
    api.post('/api/auth/login', { email, password }).then((res) => res.data),

  googleLogin: (credential) =>
    api.post('/api/auth/google', { credential }).then((res) => res.data),

  registerStudent: (credential, studentNumber) =>
    api.post('/api/auth/register-student', { credential, studentNumber }).then((res) => res.data),

  getMe: () =>
    api.get('/api/auth/me'),
};
