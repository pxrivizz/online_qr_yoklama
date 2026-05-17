import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';
import { GoogleLogin } from '@react-oauth/google';
import { GraduationCap, AlertCircle, User, X } from 'lucide-react';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '630910368260-49do92os2tnu416lsv1qko5btdnccrik.apps.googleusercontent.com';
if (!import.meta.env.VITE_GOOGLE_CLIENT_ID) {
  console.warn('VITE_GOOGLE_CLIENT_ID is not set. Using fallback client ID.');
}

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, loginWithGoogle, registerStudent, isAuthenticated, user } = useAuth();
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
        // Focus the input after modal renders
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
      // Don't close modal on error — let user fix and retry
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
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Left Side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-[#1E3A5F] via-[#1A3352] to-[#0F2440] text-white flex-col justify-center items-center p-12 relative overflow-hidden">
        {/* Decorative Elements */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-white/5 rounded-full" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-white/5 rounded-full" />

        <div className="text-center relative z-10 animate-fade-in">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-8 shadow-2xl shadow-emerald-500/30">
            <span className="text-3xl font-extrabold">QR</span>
          </div>
          <h1 className="text-4xl font-extrabold mb-4 tracking-tight">QR Katılım</h1>
          <p className="text-xl text-slate-300 mb-2 font-medium">Akıllı Katılım Yönetim Sistemi</p>
          <p className="text-sm text-slate-400 max-w-sm mx-auto leading-relaxed">QR kodları ile hızlı, güvenli ve modern katılım takibi deneyimi</p>
          
          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-3 mt-10">
            <div className="px-4 py-2 rounded-full bg-white/8 border border-white/10 text-sm text-slate-300 backdrop-blur-sm">
              📱 Anında QR Tarama
            </div>
            <div className="px-4 py-2 rounded-full bg-white/8 border border-white/10 text-sm text-slate-300 backdrop-blur-sm">
              📊 Gerçek Zamanlı Takip
            </div>
            <div className="px-4 py-2 rounded-full bg-white/8 border border-white/10 text-sm text-slate-300 backdrop-blur-sm">
              🔒 Güvenli Doğrulama
            </div>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6">
        <div className="w-full max-w-md animate-slide-up">
          {/* Mobile Logo */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-emerald-500/20">
              <span className="text-2xl font-extrabold text-white">QR</span>
            </div>
          </div>

          <Card className="!p-8 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.08)]">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-extrabold text-slate-900 mb-1 tracking-tight">Hoş Geldiniz</h2>
              <p className="text-sm text-slate-500">Sisteme giriş yapın</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-rose-50 border border-rose-200 rounded-xl animate-shake">
                <p className="text-sm text-rose-700 font-medium">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Email Adresi
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input"
                  placeholder="Email adresinizi girin"
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
                  className="input"
                  placeholder="Şifrenizi girin"
                  required
                />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-6"
                loading={isLoading}
                disabled={isLoading}
              >
                {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
              </Button>
            </form>

            <div className="mt-6 flex items-center justify-between">
              <span className="border-b w-1/5 border-slate-200 lg:w-1/4"></span>
              <span className="text-xs text-center text-slate-500 uppercase font-medium">veya şununla devam et</span>
              <span className="border-b w-1/5 border-slate-200 lg:w-1/4"></span>
            </div>

            <div className="mt-6 flex justify-center">
              <GoogleLogin
                onSuccess={handleGoogleSuccess}
                onError={handleGoogleError}
                shape="rectangular"
                theme="outline"
                size="large"
                text="continue_with"
              />
            </div>
          </Card>

          <p className="text-center text-xs text-slate-400 mt-6">
            QR Katılım Yoklama Sistemi © {new Date().getFullYear()}
          </p>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════ */}
      {/* Student Number Registration Modal              */}
      {/* ═══════════════════════════════════════════════ */}
      {showStudentModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleCloseModal}
          role="presentation"
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" style={{ animation: 'fadeIn 0.2s ease-out' }} />

          {/* Modal */}
          <div
            className="relative bg-white rounded-2xl shadow-[0_25px_60px_-12px_rgba(0,0,0,0.25)] max-w-md w-full mx-4 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="student-modal-title"
            style={{ animation: 'scaleIn 0.25s ease-out' }}
          >
            {/* Header with gradient */}
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

            {/* Body */}
            <div className="px-6 py-6">
              {/* User info card */}
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

                {/* Error message */}
                {studentError && (
                  <div className="flex items-start gap-2 mt-2 mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl" style={{ animation: 'shakeX 0.4s ease-out' }}>
                    <AlertCircle className="w-4 h-4 text-rose-500 flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-rose-700 font-medium">{studentError}</p>
                  </div>
                )}

                {!studentError && (
                  <p className="text-xs text-slate-400 mt-2 mb-4">Bu numara hesabınıza kalıcı olarak atanacaktır.</p>
                )}

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    className="flex-1"
                    onClick={handleCloseModal}
                    disabled={isRegistering}
                  >
                    İptal
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    className="flex-1"
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

      {/* Inline keyframe styles for modal animations */}
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
