import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import toast from 'react-hot-toast';

export const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

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
          </Card>

          <p className="text-center text-xs text-slate-400 mt-6">
            QR Katılım Yoklama Sistemi © {new Date().getFullYear()}
          </p>
        </div>
      </div>
    </div>
  );
};
