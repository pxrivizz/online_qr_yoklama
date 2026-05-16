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
        className="md:hidden fixed top-4 left-4 z-40 p-2.5 rounded-xl bg-[#1E3A5F] text-white shadow-lg hover:bg-[#163050] transition-all duration-200 active:scale-95"
      >
        {isOpen ? <X size={22} /> : <Menu size={22} />}
      </button>

      {/* Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm md:hidden z-30 animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-screen w-[260px] bg-gradient-to-b from-[#1E3A5F] to-[#152D4A] text-white transition-transform duration-300 ease-out z-30 ${
          isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        } flex flex-col`}
      >
        {/* Logo */}
        <div className="px-6 pt-7 pb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center shadow-lg">
              <span className="text-lg font-bold">QR</span>
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">QR Katılım</h1>
              <p className="text-[11px] text-slate-400 font-medium">Yoklama Sistemi</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 space-y-1">
          {filteredItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={() => setIsOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 px-4 py-2.5 rounded-xl transition-all duration-200 group ${
                    isActive
                      ? 'bg-white/15 text-white shadow-sm backdrop-blur-sm'
                      : 'text-slate-300 hover:bg-white/8 hover:text-white'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className={`p-1 rounded-lg ${isActive ? 'text-emerald-400' : 'text-slate-400 group-hover:text-slate-200'}`}>
                      <Icon size={19} />
                    </div>
                    <span className="text-sm font-medium">{item.label}</span>
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 rounded-full bg-emerald-400" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* User Info & Logout */}
        <div className="p-3 mx-3 mb-4 bg-white/8 rounded-xl border border-white/10 backdrop-blur-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 flex items-center justify-center text-white font-bold text-sm shadow-sm shrink-0">
              {(user?.name || user?.email)?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate leading-tight">
                {user?.name || user?.email?.split('@')[0]}
              </p>
              <p className="text-[11px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>
          
          <div className="flex items-center justify-between pt-2.5 border-t border-white/10">
            <span className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
              user?.role === 'admin' 
                ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30' 
                : user?.role === 'teacher' 
                ? 'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
            }`}>
              {user?.role === 'admin' ? 'Yönetici' : user?.role === 'teacher' ? 'Öğretmen' : 'Öğrenci'}
            </span>
            
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200"
              title="Çıkış Yap"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
