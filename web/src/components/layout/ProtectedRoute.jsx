import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

export const ProtectedRoute = ({ children, allowedRoles = [], hideLayout = false }) => {
  const { isAuthenticated, user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center animate-fade-in">
          <div className="relative w-14 h-14 mx-auto mb-5">
            <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 animate-pulse" />
            <div className="absolute inset-[3px] rounded-[10px] bg-white flex items-center justify-center">
              <span className="text-lg font-bold text-emerald-600">QR</span>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-500">Yükleniyor...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(user?.role)) {
    if (user?.role === 'student') return <Navigate to="/student/dashboard" replace />;
    return <Navigate to="/dashboard" replace />;
  }

  if (hideLayout) {
    return <>{children}</>;
  }

  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <Sidebar />
      <Header />
      <main className="flex-1 md:ml-[260px] pt-[60px] px-4 md:px-8 py-6 overflow-auto">
        <div className="max-w-7xl mx-auto animate-fade-in">
          {children}
        </div>
      </main>
    </div>
  );
};
