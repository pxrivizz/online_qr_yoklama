import { useAuth } from '../../hooks/useAuth';
import { useLocation } from 'react-router-dom';

export const Header = () => {
  const { user } = useAuth();
  const location = useLocation();

  // Get page title based on route
  const getPageTitle = () => {
    const pathMap = {
      '/dashboard': 'Dashboard',
      '/courses': 'Dersler',
      '/users': 'Kullanıcılar',
      '/my-attendance': 'Katılımlarım',
    };
    return pathMap[location.pathname] || 'QR Katılım';
  };

  // Get user initials
  const getInitials = () => {
    const name = user?.name || user?.email || 'U';
    return name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-20 md:pl-[260px]">
      <div className="bg-white/80 backdrop-blur-xl border-b border-slate-200/60">
        <div className="flex justify-between items-center px-6 py-3.5">
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">{getPageTitle()}</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{user?.name || user?.email}</p>
              <p className="text-[11px] text-slate-500 capitalize">{user?.role === 'admin' ? 'Yönetici' : user?.role === 'teacher' ? 'Öğretmen' : 'Öğrenci'}</p>
            </div>
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-white flex items-center justify-center font-bold text-sm shadow-sm">
              {getInitials()}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
