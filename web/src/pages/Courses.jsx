import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { Edit2, Trash2, Plus } from 'lucide-react';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { courseAPI } from '../api/courseAPI';

const EMPTY_FORM = {
  name: '',
  code: '',
  allowed_ssid: '',
  allowed_ip_range: '',
  allowed_latitude: '',
  allowed_longitude: '',
  allowed_radius_meters: '',
  total_sessions_planned: '',
};

const toNumberOrUndefined = (value) => {
  if (value === '' || value === null || value === undefined) return undefined;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? undefined : parsed;
};

export const Courses = () => {
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [editForm, setEditForm] = useState({});
  const [form, setForm] = useState(EMPTY_FORM);

  const { data: coursesData, isLoading, isError } = useQuery({
    queryKey: ['courses'],
    queryFn: courseAPI.getCourses,
  });

  const courses = useMemo(() => {
    if (!coursesData) return [];
    return Array.isArray(coursesData) ? coursesData : coursesData.courses || [];
  }, [coursesData]);

  const createCourseMutation = useMutation({
    mutationFn: (payload) => courseAPI.createCourse(payload),
    onSuccess: () => {
      toast.success('Ders oluşturuldu');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setIsCreateOpen(false);
      setForm(EMPTY_FORM);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Ders oluşturulamadı');
    },
  });

  const updateCourseMutation = useMutation({
    mutationFn: ({ id, payload }) => courseAPI.updateCourse(id, payload),
    onSuccess: () => {
      toast.success('Ders güncellendi');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setIsEditOpen(false);
      setSelectedCourse(null);
      setEditForm({});
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Ders güncellenemedi');
    },
  });

  const deleteCourseMutation = useMutation({
    mutationFn: (id) => courseAPI.deleteCourse(id),
    onSuccess: () => {
      toast.success('Ders silindi');
      queryClient.invalidateQueries({ queryKey: ['courses'] });
      setIsDeleteOpen(false);
      setSelectedCourse(null);
    },
    onError: (error) => {
      toast.error(error?.response?.data?.error || 'Ders silinemedi');
    },
  });

  const handleCreateCourse = (event) => {
    event.preventDefault();
    if (!form.name || !form.code) {
      toast.error('Ders adı ve kodu gerekli');
      return;
    }
    const planned = Number(form.total_sessions_planned);
    if (!planned || Number.isNaN(planned) || planned < 1 || planned > 100) {
      toast.error('Toplam yoklama sayısı 1 ile 100 arasında olmalıdır');
      return;
    }

    const payload = {
      name: form.name,
      code: form.code,
      allowed_ssid: form.allowed_ssid || undefined,
      allowed_ip_range: form.allowed_ip_range || undefined,
      allowed_latitude: toNumberOrUndefined(form.allowed_latitude),
      allowed_longitude: toNumberOrUndefined(form.allowed_longitude),
      allowed_radius_meters: toNumberOrUndefined(form.allowed_radius_meters),
      total_sessions_planned: Number(form.total_sessions_planned),
    };

    createCourseMutation.mutate(payload);
  };

  const handleOpenEdit = (course) => {
    setSelectedCourse(course);
    setEditForm({
      name: course.name || '',
      code: course.code || '',
      allowed_ssid: course.allowed_ssid || '',
      allowed_ip_range: course.allowed_ip_range || '',
      allowed_latitude: course.allowed_latitude || '',
      allowed_longitude: course.allowed_longitude || '',
      allowed_radius_meters: course.allowed_radius_meters || 100,
      total_sessions_planned: course.total_sessions_planned || '',
    });
    setIsEditOpen(true);
  };

  const handleEditCourse = (event) => {
    event.preventDefault();
    if (!selectedCourse?.id) return;
    if (!editForm.name || !editForm.code) {
      toast.error('Ders adı ve kodu gerekli');
      return;
    }
    const plannedEdit = Number(editForm.total_sessions_planned);
    if (!plannedEdit || Number.isNaN(plannedEdit) || plannedEdit < 1 || plannedEdit > 100) {
      toast.error('Toplam yoklama sayısı 1 ile 100 arasında olmalıdır');
      return;
    }

    const payload = {
      name: editForm.name,
      code: editForm.code,
      allowed_ssid: editForm.allowed_ssid || undefined,
      allowed_ip_range: editForm.allowed_ip_range || undefined,
      allowed_latitude: toNumberOrUndefined(editForm.allowed_latitude),
      allowed_longitude: toNumberOrUndefined(editForm.allowed_longitude),
      allowed_radius_meters: toNumberOrUndefined(editForm.allowed_radius_meters),
      total_sessions_planned: Number(editForm.total_sessions_planned),
    };

    updateCourseMutation.mutate({ id: selectedCourse.id, payload });
  };

  const handleDeleteCourse = () => {
    if (!selectedCourse?.id) return;
    deleteCourseMutation.mutate(selectedCourse.id);
  };

  const columns = [
    { key: 'name', label: 'Ders Adı' },
    { key: 'code', label: 'Kod' },
    {
      key: 'studentCount',
      label: 'Öğrenci Sayısı',
      render: (row) => (
        <span className="font-semibold text-gray-900">{row.studentCount || '-'}</span>
      ),
    },
    {
      key: 'network',
      label: 'İzin Verilen Ağ',
      render: (row) => (
        <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
          {row.allowed_ip_range || row.allowed_ssid || '-'}
        </span>
      ),
    },
    {
      key: 'actions',
      label: 'İşlemler',
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(row)}
            className="h-9 w-9 rounded-lg border border-gray-200 hover:bg-blue-50 text-blue-600"
          >
            <Edit2 size={16} className="mx-auto" />
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedCourse(row);
              setIsDeleteOpen(true);
            }}
            className="h-9 w-9 rounded-lg border border-gray-200 hover:bg-red-50 text-red-600"
          >
            <Trash2 size={16} className="mx-auto" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dersler</h1>
          <p className="text-gray-600 mt-1">Tüm dersleri ve atanmış öğrencileri yönetin</p>
        </div>
        <Button variant="primary" size="md" className="gap-2" onClick={() => setIsCreateOpen(true)}>
          <Plus size={18} />
          Yeni Ders Ekle
        </Button>
      </div>

      {/* Courses Table */}
      <Card>
        {isError ? (
          <div className="text-center text-red-600">Dersler yüklenemedi.</div>
        ) : (
          <Table
            columns={columns}
            data={courses}
            loading={isLoading}
            emptyMessage="Henüz ders eklenmemiştir"
          />
        )}
      </Card>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Yeni Ders Ekle" size="lg">
        <form className="space-y-4" onSubmit={handleCreateCourse}>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Ders Adı</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(event) => setForm({ ...form, name: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Ders adını girin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Ders Kodu</label>
            <input
              type="text"
              required
              value={form.code}
              onChange={(event) => setForm({ ...form, code: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="CS301"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Toplam Yoklama Sayısı</label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={form.total_sessions_planned}
              onChange={(event) => setForm({ ...form, total_sessions_planned: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Örn: 14"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">İzin Verilen SSID</label>
            <input
              type="text"
              value={form.allowed_ssid}
              onChange={(event) => setForm({ ...form, allowed_ssid: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Campus-WiFi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">İzin Verilen IP Aralığı</label>
            <input
              type="text"
              value={form.allowed_ip_range}
              onChange={(event) => setForm({ ...form, allowed_ip_range: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="192.168.1.0/24"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Enlem</label>
              <input
                type="number"
                step="any"
                value={form.allowed_latitude}
                onChange={(event) => setForm({ ...form, allowed_latitude: event.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
                placeholder="39.92077"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Boylam</label>
              <input
                type="number"
                step="any"
                value={form.allowed_longitude}
                onChange={(event) => setForm({ ...form, allowed_longitude: event.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
                placeholder="32.85411"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Yarıçap (metre)</label>
            <input
              type="number"
              value={form.allowed_radius_meters}
              onChange={(event) => setForm({ ...form, allowed_radius_meters: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="100"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" type="submit" loading={createCourseMutation.isLoading}>
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Dersi Düzenle" size="lg">
        <form className="space-y-4" onSubmit={handleEditCourse}>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Ders Adı</label>
            <input
              type="text"
              required
              value={editForm.name || ''}
              onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Ders adını girin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Ders Kodu</label>
            <input
              type="text"
              required
              value={editForm.code || ''}
              onChange={(event) => setEditForm({ ...editForm, code: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="CS301"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Toplam Yoklama Sayısı</label>
            <input
              type="number"
              min="1"
              max="100"
              required
              value={editForm.total_sessions_planned || ''}
              onChange={(event) => setEditForm({ ...editForm, total_sessions_planned: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Örn: 14"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">WiFi SSID</label>
            <input
              type="text"
              value={editForm.allowed_ssid || ''}
              onChange={(event) => setEditForm({ ...editForm, allowed_ssid: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Campus-WiFi"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">IP Aralığı</label>
            <input
              type="text"
              value={editForm.allowed_ip_range || ''}
              onChange={(event) => setEditForm({ ...editForm, allowed_ip_range: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="192.168.1.0/24"
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Enlem</label>
              <input
                type="number"
                step="any"
                value={editForm.allowed_latitude || ''}
                onChange={(event) => setEditForm({ ...editForm, allowed_latitude: event.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
                placeholder="39.92077"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Boylam</label>
              <input
                type="number"
                step="any"
                value={editForm.allowed_longitude || ''}
                onChange={(event) => setEditForm({ ...editForm, allowed_longitude: event.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
                placeholder="32.85411"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Yarıçap ({editForm.allowed_radius_meters || 100} m)</label>
            <input
              type="range"
              min="10"
              max="500"
              value={editForm.allowed_radius_meters || 100}
              onChange={(event) =>
                setEditForm({ ...editForm, allowed_radius_meters: Number(event.target.value) })
              }
              className="w-full"
            />
          </div>
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsEditOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" type="submit" loading={updateCourseMutation.isLoading}>
              Güncelle
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Dersi Sil">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Bu dersi silmek istediğinizden emin misiniz?</p>
          <p className="font-semibold text-gray-900">{selectedCourse?.name}</p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" type="button" onClick={() => setIsDeleteOpen(false)}>
              İptal
            </Button>
            <Button
              variant="danger"
              type="button"
              loading={deleteCourseMutation.isLoading}
              onClick={handleDeleteCourse}
            >
              Sil
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
