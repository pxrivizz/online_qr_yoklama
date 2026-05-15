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
    <header className="fixed top-0 left-0 right-0 bg-white shadow-sm border-b border-gray-200 z-20 md:pl-64">
      <div className="flex justify-between items-center px-6 py-4">
        <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm font-medium text-gray-900">{user?.name || user?.email}</p>
            <p className="text-xs text-gray-500">{user?.role}</p>
          </div>
          <div className="w-10 h-10 rounded-full bg-[#10B981] text-white flex items-center justify-center font-semibold">
            {getInitials()}
          </div>
        </div>
      </div>
    </header>
  );
};
