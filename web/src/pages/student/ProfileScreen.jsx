import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { userAPI } from '../../api/userAPI';
import { ArrowLeft, Camera, User, Mail, Hash, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

const API_BASE = 'http://localhost:3000';

export const ProfileScreen = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('Sadece resim dosyaları yüklenebilir'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('Dosya boyutu en fazla 5MB olabilir'); return; }
    setUploading(true);
    try {
      const res = await userAPI.uploadAvatar(file);
      const newUrl = res.data.avatar_url;
      setAvatarUrl(newUrl);
      toast.success('Profil fotoğrafı güncellendi!');
    } catch (error) {
      console.error('Avatar upload failed:', error);
      toast.error('Fotoğraf yüklenirken hata oluştu');
    } finally { setUploading(false); }
  };

  const fullAvatarUrl = avatarUrl ? `${API_BASE}${avatarUrl}` : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex flex-col">
      {/* Header */}
      <header className="bg-gradient-to-r from-[#1E3A5F] to-[#152D4A] text-white px-4 py-3.5 flex items-center gap-3 shadow-lg sticky top-0 z-50">
        <button
          onClick={() => navigate('/student/dashboard')}
          className="p-2 rounded-xl hover:bg-white/10 transition-all duration-200 active:scale-95"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-base tracking-tight">Profil</span>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6">
        {/* Avatar Section */}
        <div className="flex flex-col items-center pt-6 animate-fade-in">
          <div className="relative">
            <div className="w-[120px] h-[120px] rounded-2xl overflow-hidden border-4 border-white shadow-xl bg-slate-100 flex items-center justify-center">
              {fullAvatarUrl ? (
                <img src={fullAvatarUrl} alt="Profil" className="w-full h-full object-cover" />
              ) : (
                <User className="w-12 h-12 text-slate-300" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-2 -right-2 bg-emerald-500 text-white p-2.5 rounded-xl shadow-lg hover:bg-emerald-600 transition-all duration-200 disabled:opacity-50 active:scale-95"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileSelect} className="hidden" />

          {uploading && <p className="text-sm text-slate-500 mt-3 animate-pulse">Yükleniyor...</p>}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-3 text-sm text-emerald-600 font-semibold hover:text-emerald-700 transition-colors disabled:opacity-50"
          >
            {avatarUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'}
          </button>
        </div>

        {/* No Photo Warning */}
        {!avatarUrl && (
          <div className="bg-rose-50 border border-rose-200 rounded-2xl p-4 flex items-start gap-3 animate-slide-up">
            <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
            <div>
              <p className="text-sm font-bold text-rose-800">Profil Fotoğrafı Gerekli</p>
              <p className="text-xs text-rose-600 mt-1">
                Yoklamaya katılabilmek için profil fotoğrafınızı yüklemeniz gerekmektedir.
              </p>
            </div>
          </div>
        )}

        {/* Student Info */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 divide-y divide-slate-100 overflow-hidden">
          <div className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Ad Soyad</p>
              <p className="text-sm font-semibold text-slate-900">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Hash className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Öğrenci No</p>
              <p className="text-sm font-semibold text-slate-900">
                {user?.student_number || user?.studentNumber || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4 hover:bg-slate-50 transition-colors">
            <div className="w-9 h-9 rounded-xl bg-slate-100 flex items-center justify-center shrink-0">
              <Mail className="w-4 h-4 text-slate-500" />
            </div>
            <div>
              <p className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">E-posta</p>
              <p className="text-sm font-semibold text-slate-900">{user?.email}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfileScreen;
