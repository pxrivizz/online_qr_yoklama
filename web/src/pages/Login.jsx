import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { GraduationCap, AlertCircle, User, X, QrCode } from 'lucide-react';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithGoogle, registerStudent } = useAuth();
  const navigate = useNavigate();

  // Student number modal state
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [studentNumber, setStudentNumber] = useState('');
  const [studentError, setStudentError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [pendingCredential, setPendingCredential] = useState(null);
  const [pendingGoogleUser, setPendingGoogleUser] = useState(null);
  const studentInputRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const loggedInUser = await login(email, password);
      if (loggedInUser?.role === 'student') {
        navigate('/student/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const message = err?.response?.data?.error || 'Geçersiz email veya şifre';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSuccess = async (credentialResponse) => {
    try {
      setIsLoading(true);
      setError('');
      const result = await loginWithGoogle(credentialResponse.credential);

      // Check if backend requires student number
      if (result?.requireStudentId) {
        setPendingCredential(credentialResponse.credential);
        setPendingGoogleUser(result.googleUser);
        setShowStudentModal(true);
        setStudentNumber('');
        setStudentError('');
        setTimeout(() => studentInputRef.current?.focus(), 150);
        return;
      }

      // Existing user logged in successfully
      if (result?.role === 'student') {
        navigate('/student/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const message = err?.response?.data?.error || 'Google ile giriş başarısız oldu.';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleError = () => {
    console.error("Google Login Failed");
    toast.error('Google ile giriş başarısız oldu.');
  };

  const handleStudentRegister = async (e) => {
    e.preventDefault();
    setStudentError('');

    if (!studentNumber.trim()) {
      setStudentError('Öğrenci numarası zorunludur.');
      return;
    }

    if (!/^\d+$/.test(studentNumber.trim())) {
      setStudentError('Öğrenci numarası sadece rakamlardan oluşmalıdır.');
      return;
    }

    setIsRegistering(true);
    try {
      const registeredUser = await registerStudent(pendingCredential, studentNumber.trim());
      setShowStudentModal(false);
      setPendingCredential(null);
      setPendingGoogleUser(null);

      if (registeredUser?.role === 'student') {
        navigate('/student/dashboard', { replace: true });
      } else {
        navigate('/dashboard', { replace: true });
      }
    } catch (err) {
      const message = err?.response?.data?.error || 'Kayıt sırasında bir hata oluştu.';
      setStudentError(message);
    } finally {
      setIsRegistering(false);
    }
  };

  const handleCloseModal = () => {
    if (isRegistering) return;
    setShowStudentModal(false);
    setPendingCredential(null);
    setPendingGoogleUser(null);
    setStudentNumber('');
    setStudentError('');
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden animate-slide-up border border-slate-100">
        {/* Navy Banner Section */}
        <div className="bg-[#1E3A5F] px-8 py-10 text-center relative overflow-hidden">
          {/* Subtle decorations */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl translate-x-10 -translate-y-10" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-400/10 rounded-full blur-xl -translate-x-5 translate-y-5" />

          <div className="relative z-10 flex flex-col items-center justify-center">
            <div className="w-16 h-16 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 flex items-center justify-center mb-5 shadow-lg">
              <QrCode className="w-8 h-8 text-white" />
            </div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold text-white tracking-wide">Online Yoklama</h1>
            </div>
            <p className="text-sm text-blue-200/80 font-medium tracking-wide">Teknoloji Fakültesi Online Yoklama</p>
          </div>
        </div>

        {/* Form Content */}
        <div className="p-8">
          {error && (
            <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl animate-shake flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-rose-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-rose-700 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                E-posta Adresi
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all duration-200 placeholder:text-slate-400 font-medium text-base"
                placeholder="ornek@posta.mu.edu.tr"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-2">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1E3A5F]/20 focus:border-[#1E3A5F] transition-all duration-200 placeholder:text-slate-400 font-medium text-base"
                placeholder="••••••••"
                required
              />
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 mt-4 bg-[#1E3A5F] hover:bg-[#152a45] active:bg-[#0f1e32] text-white font-semibold rounded-xl shadow-lg shadow-[#1E3A5F]/20 transition-all duration-200 disabled:opacity-70 flex items-center justify-center text-base"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                'Giriş Yap'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="mt-8 mb-6 flex items-center justify-between">
            <span className="border-b w-full border-slate-200"></span>
            <span className="px-4 text-xs text-slate-400 uppercase font-bold tracking-wider">veya</span>
            <span className="border-b w-full border-slate-200"></span>
          </div>

          {/* Google Login Button */}
          <div>
            <div className="relative w-full h-12 flex items-center justify-center bg-white border border-slate-200 rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors cursor-pointer overflow-hidden shadow-sm">
              {/* Visual Button */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="absolute left-4 flex items-center">
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                  </svg>
                </div>
                <span className="text-sm font-semibold text-slate-700">Google ile Giriş Yap</span>
              </div>

              {/* Invisible GoogleLogin to capture clicks and handle auth */}
              <div className="absolute inset-0 opacity-0 z-10 w-full h-full flex items-center justify-center transform scale-150">
                <GoogleLogin
                  onSuccess={handleGoogleSuccess}
                  onError={handleGoogleError}
                  width="800"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-slate-50 py-4 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400 font-medium">
            Online Yoklama Sistemi © {new Date().getFullYear()}
          </p>
          <p className="text-xs text-slate-400 font-medium">
            Created by pxrivizz
          </p>
        </div>
      </div>

      {/* Student Number Registration Modal */}
      {showStudentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
          role="presentation"
        >
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }} />

          <div
            className="relative bg-white rounded-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)] max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="student-modal-title"
            style={{ animation: 'scaleIn 0.25s ease-out' }}
          >
            <div className="bg-gradient-to-r from-[#1E3A5F] to-[#2a4d7a] px-6 py-5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h2 id="student-modal-title" className="text-lg font-bold text-white">Kayıt Tamamla</h2>
                    <p className="text-xs text-slate-300">Öğrenci numaranızı girin</p>
                  </div>
                </div>
                <button
                  onClick={handleCloseModal}
                  disabled={isRegistering}
                  className="p-2 -m-1 rounded-xl text-white/60 hover:text-white hover:bg-white/10 transition-all duration-200 disabled:opacity-50"
                  aria-label="Kapat"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="px-6 py-6">
              {pendingGoogleUser && (
                <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl border border-slate-100 mb-5">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center flex-shrink-0">
                    {pendingGoogleUser.picture ? (
                      <img
                        src={pendingGoogleUser.picture}
                        alt=""
                        className="w-10 h-10 rounded-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <User className="w-5 h-5 text-white" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{pendingGoogleUser.name}</p>
                    <p className="text-xs text-slate-500 truncate">{pendingGoogleUser.email}</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleStudentRegister}>
                <div className="mb-1">
                  <label htmlFor="studentNumber" className="block text-sm font-semibold text-slate-700 mb-2">
                    Öğrenci Numarası
                  </label>
                  <input
                    ref={studentInputRef}
                    id="studentNumber"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={studentNumber}
                    onChange={(e) => {
                      setStudentNumber(e.target.value);
                      if (studentError) setStudentError('');
                    }}
                    className={`w-full px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all duration-200 outline-none bg-white
                      ${studentError
                        ? 'border-rose-300 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/10'
                        : 'border-slate-200 focus:border-[#1E3A5F] focus:ring-4 focus:ring-[#1E3A5F]/10'
                      }
                      placeholder:text-slate-400`}
                    placeholder="Örn: 220501001"
                    autoComplete="off"
                    disabled={isRegistering}
                  />
                </div>

                {studentError && (
                  <div className="flex items-start gap-2 mt-2 mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl" style={{ animation: 'shakeX 0.4s ease-out' }}>
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700 font-medium">{studentError}</p>
                  </div>
                )}

                {!studentError && (
                  <p className="text-xs text-slate-400 mt-2 mb-4">Bu numara hesabınıza kalıcı olarak atanacaktır.</p>
                )}

                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="flex-1 h-12 rounded-xl"
                    onClick={handleCloseModal}
                    disabled={isRegistering}
                  >
                    İptal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-1 h-12 rounded-xl bg-[#1E3A5F] hover:bg-[#152a45]"
                    loading={isRegistering}
                    disabled={isRegistering || !studentNumber.trim()}
                  >
                    {isRegistering ? 'Kaydediliyor...' : 'Kayıt Ol'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from { opacity: 0; transform: scale(0.95) translateY(10px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes shakeX {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-6px); }
          40% { transform: translateX(6px); }
          60% { transform: translateX(-4px); }
          80% { transform: translateX(4px); }
        }
      `}</style>
    </div>
  );
};
