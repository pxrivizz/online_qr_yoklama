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

    if (!file.type.startsWith('image/')) {
      toast.error('Sadece resim dosyaları yüklenebilir');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Dosya boyutu en fazla 5MB olabilir');
      return;
    }

    setUploading(true);
    try {
      const res = await userAPI.uploadAvatar(file);
      const newUrl = res.data.avatar_url;
      setAvatarUrl(newUrl);
      toast.success('Profil fotoğrafı güncellendi!');
    } catch (error) {
      console.error('Avatar upload failed:', error);
      toast.error('Fotoğraf yüklenirken hata oluştu');
    } finally {
      setUploading(false);
    }
  };

  const fullAvatarUrl = avatarUrl ? `${API_BASE}${avatarUrl}` : null;

  return (
    <div className="min-h-screen bg-[#F8FAFC] flex flex-col">
      {/* Header */}
      <header className="bg-[#1E3A5F] text-white px-4 py-3 flex items-center gap-3 shadow-md sticky top-0 z-50">
        <button
          onClick={() => navigate('/student/dashboard')}
          className="p-1.5 rounded-lg hover:bg-[#163050] transition-colors"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-lg">Profil</span>
      </header>

      <main className="flex-1 p-4 max-w-lg mx-auto w-full space-y-6">
        {/* Avatar Section */}
        <div className="flex flex-col items-center pt-4">
          <div className="relative">
            <div className="w-[120px] h-[120px] rounded-full overflow-hidden border-4 border-[#1E3A5F] shadow-lg bg-gray-100 flex items-center justify-center">
              {fullAvatarUrl ? (
                <img
                  src={fullAvatarUrl}
                  alt="Profil"
                  className="w-full h-full object-cover"
                />
              ) : (
                <User className="w-12 h-12 text-gray-400" />
              )}
            </div>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute bottom-0 right-0 bg-[#10B981] text-white p-2 rounded-full shadow-md hover:bg-[#059669] transition-colors disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
            </button>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {uploading && (
            <p className="text-sm text-gray-500 mt-2 animate-pulse">Yükleniyor...</p>
          )}

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="mt-3 text-sm text-[#1E3A5F] font-medium hover:underline disabled:opacity-50"
          >
            {avatarUrl ? 'Fotoğrafı Değiştir' : 'Fotoğraf Yükle'}
          </button>
        </div>

        {/* No Photo Warning */}
        {!avatarUrl && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-800">Profil Fotoğrafı Gerekli</p>
              <p className="text-xs text-red-600 mt-1">
                Yoklamaya katılabilmek için profil fotoğrafınızı yüklemeniz gerekmektedir.
              </p>
            </div>
          </div>
        )}

        {/* Student Info */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-100">
          <div className="flex items-center gap-3 p-4">
            <User className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Ad Soyad</p>
              <p className="text-sm font-semibold text-gray-900">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Hash className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">Öğrenci No</p>
              <p className="text-sm font-semibold text-gray-900">
                {user?.student_number || user?.studentNumber || '—'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-4">
            <Mail className="w-5 h-5 text-gray-400" />
            <div>
              <p className="text-xs text-gray-500">E-posta</p>
              <p className="text-sm font-semibold text-gray-900">{user?.email}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default ProfileScreen;
