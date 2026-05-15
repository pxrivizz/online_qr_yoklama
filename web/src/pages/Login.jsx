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
    <div className="flex h-screen bg-[#F8FAFC]">
      {/* Left Side - Branding */}
      <div className="hidden md:flex md:w-1/2 bg-gradient-to-br from-[#1E3A5F] to-[#163050] text-white flex-col justify-center items-center p-12">
        <div className="text-center">
          <div className="text-6xl mb-6">🎓</div>
          <h1 className="text-4xl font-bold mb-4">QR Katılım</h1>
          <p className="text-xl text-gray-300 mb-2">Akıllı Katılım Yönetim Sistemi</p>
          <p className="text-gray-400">QR kodları ile hızlı ve güvenli katılım takibi</p>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full md:w-1/2 flex items-center justify-center p-6">
        <Card className="w-full max-w-md shadow-lg">
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🎓</div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Hoş Geldiniz</h2>
            <p className="text-gray-600">Sisteme giriş yapın</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Email Adresi
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all"
                placeholder="Email adresinizi girin"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-2">
                Şifre
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#10B981] focus:border-transparent outline-none transition-all"
                placeholder="Şifrenizi girin"
                required
              />
            </div>

            <Button
              type="submit"
              variant="primary"
              size="md"
              className="w-full mt-6"
              loading={isLoading}
              disabled={isLoading}
            >
              {isLoading ? 'Giriş yapılıyor...' : 'Giriş Yap'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
};
