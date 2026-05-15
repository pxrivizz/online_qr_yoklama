import { NavLink } from 'react-router-dom';
import { Menu, X, LayoutDashboard, BookOpen, Users, ClipboardList, LogOut } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import { Button } from '../ui/Button';

export const Sidebar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const { user, logout } = useAuth();

  const menuItems = [
    { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'teacher', 'student'] },
    { path: '/courses', label: 'Dersler', icon: BookOpen, roles: ['admin', 'teacher'] },
    { path: '/users', label: 'Kullanıcılar', icon: Users, roles: ['admin'] },
    { path: '/my-attendance', label: 'Katılımlarım', icon: ClipboardList, roles: ['student'] },
  ];

  const filteredItems = menuItems.filter((item) => item.roles.includes(user?.role));

  const handleLogout = () => {
    logout();
    setIsOpen(false);
  };

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-[#1E3A5F] text-white"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 md:hidden z-30"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-64 bg-[#1E3A5F] text-white transition-transform duration-300 z-30 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } flex flex-col`}
      >
        <div className="p-6 flex-1">
          <h1 className="text-2xl font-bold mb-8 mt-4">QR Katılım</h1>

          <nav className="space-y-2">
            {filteredItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'bg-[#10B981] text-white'
                        : 'text-gray-200 hover:bg-[#2a4a7c]'
                    }`
                  }
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* User Info & Logout */}
        <div className="p-4 mx-4 mb-4 bg-[#163050]/40 rounded-xl border border-[#163050] backdrop-blur-sm shadow-inner transition-all duration-200 mt-auto">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#10B981] to-[#3B82F6] flex items-center justify-center text-white font-bold text-base shadow-sm">
              {(user?.name || user?.email)?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || user?.email?.split('@')[0]}
              </p>
              <p className="text-xs text-gray-400 truncate">{user?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-3 border-t border-[#163050]">
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
              user?.role === 'admin' 
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                : user?.role === 'teacher' 
                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                : 'bg-green-500/20 text-green-300 border border-green-500/30'
            }`}>
              {user?.role === 'admin' ? 'Yönetici' : user?.role === 'teacher' ? 'Öğretmen' : 'Öğrenci'}
            </span>
            
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all duration-200 flex items-center gap-1 text-sm font-medium"
              title="Çıkış Yap"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
