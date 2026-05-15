import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Edit2, Trash2, Plus, Search, Upload, Download, X, AlertCircle, CheckCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import toast from 'react-hot-toast';
import { Card } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Table } from '../components/ui/Table';
import { Modal } from '../components/ui/Modal';
import { userAPI } from '../api/userAPI';
import { importAPI } from '../api/importAPI';
import { courseAPI } from '../api/courseAPI';

const ROLE_LABELS = {
  student: 'Öğrenci',
  teacher: 'Öğretmen',
};

const EMPTY_FORM = {
  name: '',
  email: '',
  password: '',
  role: 'student',
  student_number: '',
};

export const Users = () => {
  const queryClient = useQueryClient();
  const [activeRole, setActiveRole] = useState('student');
  const [search, setSearch] = useState('');
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isBulkOpen, setIsBulkOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [createForm, setCreateForm] = useState(EMPTY_FORM);
  const [editForm, setEditForm] = useState(EMPTY_FORM);
  const [bulkFile, setBulkFile] = useState(null);
  const [bulkStudents, setBulkStudents] = useState([]);
  const [bulkResult, setBulkResult] = useState(null);
  const [bulkParsing, setBulkParsing] = useState(false);
  const [isBulkDeleteOpen, setIsBulkDeleteOpen] = useState(false);
  const [deleteFile, setDeleteFile] = useState(null);
  const [deleteTargets, setDeleteTargets] = useState([]);
  const [deletePreview, setDeletePreview] = useState(null);
  const [deleteParsing, setDeleteParsing] = useState(false);
  
  // Excel import state
  const [isExcelImportOpen, setIsExcelImportOpen] = useState(false);
  const [excelStep, setExcelStep] = useState(1); // 1: file, 2: preview, 3: result
  const [excelFile, setExcelFile] = useState(null);
  const [excelData, setExcelData] = useState(null);
  const [excelResult, setExcelResult] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [isParsingExcel, setIsParsingExcel] = useState(false);
  const [isImportingExcel, setIsImportingExcel] = useState(false);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['users'],
    queryFn: () => userAPI.getUsers().then((res) => res.data),
  });

  const { data: coursesData } = useQuery({
    queryKey: ['courses'],
    queryFn: () => courseAPI.getCourses(),
  });

  const users = useMemo(() => {
    if (!data) return [];
    return Array.isArray(data) ? data : data.users || [];
  }, [data]);

  const roleCounts = useMemo(() => {
    const counts = { student: 0, teacher: 0 };
    users.forEach((user) => {
      const role = user.role || user.user_role;
      if (role === 'student' || role === 'teacher') counts[role] += 1;
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return users
      .filter((user) => {
        const role = user.role || user.user_role;
        return role === activeRole;
      })
      .filter((user) => {
        if (!query) return true;
        const name = (user.name || user.full_name || '').toLowerCase();
        const email = (user.email || '').toLowerCase();
        const studentNumber = `${user.student_number || user.studentNumber || ''}`.toLowerCase();
        return name.includes(query) || email.includes(query) || studentNumber.includes(query);
      })
      .map((user) => ({
        ...user,
        displayName: user.name || user.full_name || '-',
        studentNumber: user.student_number || user.studentNumber || '-',
        createdAt: user.created_at || user.createdAt || user.created_at_iso || null,
      }));
  }, [users, activeRole, search]);

  const createUserMutation = useMutation({
    mutationFn: (payload) => userAPI.createUser(payload),
    onSuccess: () => {
      toast.success('Kullanıcı oluşturuldu');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsCreateOpen(false);
      setCreateForm({ ...EMPTY_FORM, role: activeRole });
    },
    onError: () => toast.error('Kullanıcı oluşturulamadı'),
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, payload }) => userAPI.updateUser(id, payload),
    onSuccess: () => {
      toast.success('Kullanıcı güncellendi');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsEditOpen(false);
      setSelectedUser(null);
    },
    onError: () => toast.error('Kullanıcı güncellenemedi'),
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id) => userAPI.deleteUser(id),
    onSuccess: () => {
      toast.success('Kullanıcı silindi');
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setIsDeleteOpen(false);
      setSelectedUser(null);
    },
    onError: () => toast.error('Kullanıcı silinemedi'),
  });

  const bulkCreateMutation = useMutation({
    mutationFn: (students) => userAPI.bulkCreateStudents(students),
    onSuccess: (res) => {
      const added = res?.data?.added ?? res?.data?.created ?? bulkStudents.length;
      const skipped = res?.data?.skipped ?? 0;
      toast.success(`${added} öğrenci eklendi, ${skipped} atlandı`);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setBulkResult({ added, skipped });
      setBulkStudents([]);
      setBulkFile(null);
    },
    onError: () => toast.error('Toplu yükleme başarısız'),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: async (ids) => {
      const result = await userAPI.bulkDeleteUsers(ids);
      return result;
    },
    onSuccess: (result) => {
      toast.success(`${result.deleted} öğrenci silindi`);
      if (result.failed > 0) {
        toast.error(`${result.failed} öğrenci silinemedi`);
      }
      queryClient.invalidateQueries({ queryKey: ['users'] });
      setDeleteFile(null);
      setDeleteTargets([]);
      setDeletePreview(null);
      setIsBulkDeleteOpen(false);
    },
    onError: () => toast.error('Toplu silme başarısız'),
  });

  const handleOpenCreate = () => {
    setCreateForm({ ...EMPTY_FORM, role: activeRole });
    setIsCreateOpen(true);
  };

  const handleOpenEdit = (user) => {
    setSelectedUser(user);
    setEditForm({
      name: user.name || user.full_name || '',
      email: user.email || '',
      password: '',
      role: user.role || user.user_role || activeRole,
      student_number: user.student_number || user.studentNumber || '',
    });
    setIsEditOpen(true);
  };

  const handleCreateSubmit = (event) => {
    event.preventDefault();
    if (!createForm.name || !createForm.email || !createForm.password) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    const payload = {
      name: createForm.name,
      email: createForm.email,
      password: createForm.password,
      role: createForm.role,
    };
    if (createForm.role === 'student') {
      payload.student_number = createForm.student_number || undefined;
    }
    createUserMutation.mutate(payload);
  };

  const handleEditSubmit = (event) => {
    event.preventDefault();
    if (!selectedUser) return;

    const payload = {
      name: editForm.name,
      email: editForm.email,
      role: editForm.role,
    };
    if (editForm.password) {
      payload.password = editForm.password;
    }
    if (editForm.role === 'student') {
      payload.student_number = editForm.student_number || undefined;
    }

    updateUserMutation.mutate({ id: selectedUser.id, payload });
  };

  const handleDeleteConfirm = () => {
    if (!selectedUser) return;
    deleteUserMutation.mutate(selectedUser.id);
  };

  const handleTemplateDownload = () => {
    const rows = [
      ['name', 'email', 'password', 'student_number'],
      ['Ayşe Kaya', 'ayse@student.edu', 'Şifre123', '2021001'],
      ['Mehmet Demir', 'mehmet@student.edu', 'Şifre123', '2021002'],
    ];
    const worksheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Students');
    XLSX.writeFile(workbook, 'ogrenci-sablon.xlsx');
  };

  const handleExcelImportOpen = () => {
    setExcelStep(1);
    setExcelFile(null);
    setExcelData(null);
    setExcelResult(null);
    setSelectedCourseId('');
    setIsExcelImportOpen(true);
  };

  const handleExcelFileSelect = async (file) => {
    if (!file) return;

    setExcelFile(file);
    setIsParsingExcel(true);
    try {
      const parsed = await importAPI.parseEnrollmentExcel(file);
      setExcelData(parsed);
      setExcelStep(2);
      toast.success(`${parsed.students.length} öğrenci bulundu`);
    } catch (error) {
      toast.error(error.message || 'Dosya işlenemedi');
      setExcelFile(null);
      setExcelData(null);
    } finally {
      setIsParsingExcel(false);
    }
  };

  const handleExcelImport = async () => {
    if (!selectedCourseId) {
      toast.error('Lütfen bir ders seçin');
      return;
    }
    if (!excelFile) {
      toast.error('Dosya bulunamadı');
      return;
    }

    setIsImportingExcel(true);
    try {
      const response = await importAPI.importEnrollmentExcel(excelFile, selectedCourseId);
      const result = response.data || response;
      setExcelResult(result);
      setExcelStep(3);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (error) {
      toast.error('İçeri aktarma başarısız oldu');
      console.error('Import error:', error);
    } finally {
      setIsImportingExcel(false);
    }
  };

  const handleExcelImportClose = () => {
    setIsExcelImportOpen(false);
    setExcelStep(1);
    setExcelFile(null);
    setExcelData(null);
    setExcelResult(null);
    setSelectedCourseId('');
  };

  const parseBulkFile = async (file) => {
    setBulkParsing(true);
    setBulkResult(null);
    try {
      const parsed = await importAPI.parseEnrollmentExcel(file);
      const students = parsed.students
        .map((student) => ({
          name: String(student.full_name || '').trim(),
          email: `${String(student.student_number || '').trim()}@posta.mu.edu.tr`,
          password: String(student.student_number || '').trim(),
          student_number: String(student.student_number || '').trim(),
        }))
        .filter((row) => row.name && row.email && row.password);
      setBulkStudents(students);
    } catch (error) {
      toast.error('Dosya okunamadı');
      setBulkStudents([]);
    } finally {
      setBulkParsing(false);
    }
  };

  const handleBulkUpload = () => {
    if (bulkStudents.length === 0) {
      toast.error('Yüklenecek öğrenci bulunamadı');
      return;
    }
    bulkCreateMutation.mutate(bulkStudents);
  };

  const parseBulkDeleteFile = async (file) => {
    setDeleteParsing(true);
    setDeletePreview(null);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });

      const studentCandidates = rows
        .map((row) => ({
          student_number: String(row.student_number || row['Öğrenci No'] || '').trim(),
          email: String(row.email || row['Email'] || '').trim().toLowerCase(),
        }))
        .filter((row) => row.student_number || row.email);

      const studentUsers = users.filter((u) => (u.role || u.user_role) === 'student');
      const matched = [];
      const notFound = [];

      studentCandidates.forEach((candidate) => {
        const found = studentUsers.find((u) => {
          const uStudentNo = String(u.student_number || u.studentNumber || '').trim();
          const uEmail = String(u.email || '').trim().toLowerCase();
          return (
            (candidate.student_number && uStudentNo && candidate.student_number === uStudentNo) ||
            (candidate.email && uEmail && candidate.email === uEmail)
          );
        });

        if (found) {
          matched.push(found);
        } else {
          notFound.push(candidate.student_number || candidate.email);
        }
      });

      const uniqueMatched = Array.from(new Map(matched.map((u) => [u.id, u])).values());
      setDeleteTargets(uniqueMatched);
      setDeletePreview({
        total: studentCandidates.length,
        matched: uniqueMatched.length,
        notFound,
      });
    } catch (error) {
      toast.error('Silme dosyası okunamadı');
      setDeleteTargets([]);
      setDeletePreview(null);
    } finally {
      setDeleteParsing(false);
    }
  };

  const handleBulkDelete = () => {
    if (!deleteTargets.length) {
      toast.error('Silinecek öğrenci bulunamadı');
      return;
    }
    bulkDeleteMutation.mutate(deleteTargets.map((u) => u.id));
  };

  const columns = useMemo(() => {
    if (activeRole === 'student') {
      return [
        { key: 'displayName', label: 'Ad Soyad' },
        { key: 'email', label: 'Email' },
        { key: 'studentNumber', label: 'Öğrenci No' },
        {
          key: 'createdAt',
          label: 'Kayıt Tarihi',
          render: (row) => formatDate(row.createdAt),
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
                aria-label="Edit user"
              >
                <Edit2 size={16} className="mx-auto" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedUser(row);
                  setIsDeleteOpen(true);
                }}
                className="h-9 w-9 rounded-lg border border-gray-200 hover:bg-red-50 text-red-600"
                aria-label="Delete user"
              >
                <Trash2 size={16} className="mx-auto" />
              </button>
            </div>
          ),
        },
      ];
    }

    return [
      { key: 'displayName', label: 'Ad Soyad' },
      { key: 'email', label: 'Email' },
      {
        key: 'createdAt',
        label: 'Kayıt Tarihi',
        render: (row) => formatDate(row.createdAt),
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
              aria-label="Edit user"
            >
              <Edit2 size={16} className="mx-auto" />
            </button>
            <button
              type="button"
              onClick={() => {
                setSelectedUser(row);
                setIsDeleteOpen(true);
              }}
              className="h-9 w-9 rounded-lg border border-gray-200 hover:bg-red-50 text-red-600"
              aria-label="Delete user"
            >
              <Trash2 size={16} className="mx-auto" />
            </button>
          </div>
        ),
      },
    ];
  }, [activeRole]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Kullanıcılar</h1>
          <p className="text-gray-600 mt-1">Sistem kullanıcılarını yönetin</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            size="md"
            className="gap-2 border-red-300 text-red-600 hover:bg-red-50"
            onClick={() => setIsBulkDeleteOpen(true)}
          >
            <Trash2 size={16} />
            Toplu Öğrenci Sil
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="gap-2 border-[#10B981] text-[#10B981] hover:bg-green-50"
            onClick={handleExcelImportOpen}
          >
            <Upload size={16} />
            Excel'den Öğrenci Yükle
          </Button>
          
          {/*

          <Button
            variant="secondary"
            size="md"
            className="gap-2"
            onClick={() => setIsBulkOpen(true)}
          >
            <Upload size={16} />
            Toplu Öğrenci Yükle
          </Button>

          */}
          <Button
            variant="primary"
            size="md"
            className="gap-2 bg-[#10B981] hover:bg-[#059669]"
            onClick={handleOpenCreate}
          >
            <Plus size={18} />
            Kullanıcı Ekle
          </Button>
        </div>
      </div>

      <div className="flex border-b border-gray-200">
        {['student', 'teacher'].map((role) => (
          <button
            key={role}
            type="button"
            onClick={() => setActiveRole(role)}
            className={`px-4 py-3 font-semibold border-b-2 transition-colors ${
              activeRole === role
                ? 'border-[#10B981] text-[#10B981]'
                : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            {ROLE_LABELS[role]}
            <span className="ml-2 inline-flex items-center justify-center w-6 h-6 bg-gray-100 rounded-full text-xs font-bold">
              {roleCounts[role] || 0}
            </span>
          </button>
        ))}
      </div>

      <Card className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-3 flex-1">
          <Search size={20} className="text-gray-400" />
          <input
            type="text"
            placeholder="Ad veya email ile ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="flex-1 bg-transparent outline-none text-gray-900 placeholder-gray-500"
          />
        </div>
        <div className="text-sm text-gray-500">{filteredUsers.length} kayıt</div>
      </Card>

      <Card>
        {isError ? (
          <div className="text-center text-red-600">Kullanıcılar yüklenemedi.</div>
        ) : (
          <Table
            columns={columns}
            data={filteredUsers}
            loading={isLoading}
            emptyMessage="Hiç kullanıcı bulunamadı"
          />
        )}
      </Card>

      <Modal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} title="Kullanıcı Ekle">
        <form className="space-y-4" onSubmit={handleCreateSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Ad Soyad</label>
            <input
              type="text"
              required
              value={createForm.name}
              onChange={(event) => setCreateForm({ ...createForm, name: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Ad soyadını girin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
            <input
              type="email"
              required
              value={createForm.email}
              onChange={(event) => setCreateForm({ ...createForm, email: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Email adresini girin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Şifre</label>
            <input
              type="password"
              required
              value={createForm.password}
              onChange={(event) => setCreateForm({ ...createForm, password: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Şifre girin"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Rol</label>
            <select
              value={createForm.role}
              onChange={(event) => setCreateForm({ ...createForm, role: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
            >
              <option value="student">Öğrenci</option>
              <option value="teacher">Öğretmen</option>
            </select>
          </div>
          {createForm.role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Öğrenci No</label>
              <input
                type="text"
                value={createForm.student_number}
                onChange={(event) => setCreateForm({ ...createForm, student_number: event.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
                placeholder="Öğrenci numarasını girin"
              />
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsCreateOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" type="submit" loading={createUserMutation.isLoading}>
              Kaydet
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isEditOpen} onClose={() => setIsEditOpen(false)} title="Kullanıcıyı Düzenle">
        <form className="space-y-4" onSubmit={handleEditSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Ad Soyad</label>
            <input
              type="text"
              required
              value={editForm.name}
              onChange={(event) => setEditForm({ ...editForm, name: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Email</label>
            <input
              type="email"
              required
              value={editForm.email}
              onChange={(event) => setEditForm({ ...editForm, email: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Şifre</label>
            <input
              type="password"
              value={editForm.password}
              onChange={(event) => setEditForm({ ...editForm, password: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              placeholder="Boş bırakırsanız değişmez"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">Rol</label>
            <select
              value={editForm.role}
              onChange={(event) => setEditForm({ ...editForm, role: event.target.value })}
              className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
            >
              <option value="student">Öğrenci</option>
              <option value="teacher">Öğretmen</option>
            </select>
          </div>
          {editForm.role === 'student' && (
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Öğrenci No</label>
              <input
                type="text"
                value={editForm.student_number}
                onChange={(event) => setEditForm({ ...editForm, student_number: event.target.value })}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              />
            </div>
          )}
          <div className="flex gap-3 justify-end pt-2">
            <Button variant="secondary" type="button" onClick={() => setIsEditOpen(false)}>
              İptal
            </Button>
            <Button variant="primary" type="submit" loading={updateUserMutation.isLoading}>
              Güncelle
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={isDeleteOpen} onClose={() => setIsDeleteOpen(false)} title="Kullanıcıyı Sil">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Bu kullanıcıyı silmek istediğinizden emin misiniz?</p>
          <p className="font-semibold text-gray-900">{selectedUser?.displayName || selectedUser?.name}</p>
          <div className="flex gap-3 justify-end">
            <Button variant="secondary" type="button" onClick={() => setIsDeleteOpen(false)}>
              İptal
            </Button>
            <Button
              variant="danger"
              type="button"
              loading={deleteUserMutation.isLoading}
              onClick={handleDeleteConfirm}
            >
              Sil
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={isBulkDeleteOpen} onClose={() => setIsBulkDeleteOpen(false)} title="Toplu Öğrenci Sil" size="lg">
        <div className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Excel dosyasından öğrenci numarası veya email ile toplu silme yapın.</p>
            <p className="text-xs text-gray-500 mt-1">Desteklenen sütunlar: student_number veya email</p>
          </div>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setDeleteFile(file || null);
              setDeleteTargets([]);
              setDeletePreview(null);
              if (file) parseBulkDeleteFile(file);
            }}
            className="w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
          />

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            {deleteParsing ? (
              'Dosya analiz ediliyor...'
            ) : deletePreview ? (
              <div className="space-y-1">
                <p>{deletePreview.total} kayıt okundu.</p>
                <p className="text-green-700">{deletePreview.matched} öğrenci silinecek.</p>
                <p className="text-red-700">{deletePreview.notFound.length} kayıt bulunamadı.</p>
              </div>
            ) : (
              'Henüz dosya seçilmedi.'
            )}
          </div>

          {deletePreview?.notFound?.length > 0 && (
            <div className="rounded-lg border border-red-100 bg-red-50 p-4">
              <p className="text-sm font-semibold text-red-700 mb-2">Sistemde Bulunamayanlar</p>
              <ul className="text-sm text-red-600 space-y-1 max-h-32 overflow-auto">
                {deletePreview.notFound.slice(0, 10).map((item, index) => (
                  <li key={`${item}-${index}`}>{item}</li>
                ))}
              </ul>
              {deletePreview.notFound.length > 10 && (
                <p className="text-xs text-red-500 mt-2">... ve {deletePreview.notFound.length - 10} kayıt daha</p>
              )}
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" type="button" onClick={() => setIsBulkDeleteOpen(false)}>
              İptal
            </Button>
            <Button
              variant="danger"
              type="button"
              loading={bulkDeleteMutation.isLoading}
              onClick={handleBulkDelete}
              disabled={!deleteFile || !deleteTargets.length}
            >
              Toplu Sil
            </Button>
          </div>
        </div>
      </Modal>
      {/* Excel Import Modal - Multi-Step */}
      <Modal isOpen={isExcelImportOpen} onClose={handleExcelImportClose} title="Excel'den Öğrenci Yükle" size="lg">
        {excelStep === 1 && (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 mb-4">Öğrenci bilgilerini içeren Excel dosyasını seçin.</p>
            
            {/* Drag & Drop Area */}
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#10B981] hover:bg-green-50 transition-colors cursor-pointer"
              onDragOver={(e) => {
                e.preventDefault();
              }}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files?.[0];
                if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
                  handleExcelFileSelect(file);
                } else {
                  toast.error('Sadece .xlsx veya .xls dosyası yükleyebilirsiniz');
                }
              }}
            >
              <Upload size={32} className="mx-auto text-gray-400 mb-2" />
              <p className="text-sm text-gray-600 font-medium">Dosyayı buraya sürükleyin veya tıklayın</p>
              <p className="text-xs text-gray-500 mt-1">Sadece .xlsx veya .xls dosyası yükleyebilirsiniz</p>
              <input
                type="file"
                accept=".xlsx,.xls"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleExcelFileSelect(file);
                }}
                className="hidden"
                id="excel-file-input"
              />
              <label htmlFor="excel-file-input" className="cursor-pointer">
                {excelFile && <p className="text-xs text-green-600 mt-2">✓ {excelFile.name}</p>}
              </label>
            </div>

            {isParsingExcel && <p className="text-sm text-gray-500 text-center">Dosya işleniyor...</p>}

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={handleExcelImportClose}>
                İptal
              </Button>
            </div>
          </div>
        )}

        {excelStep === 2 && excelData && (
          <div className="space-y-4">
            {/* Course Detection */}
            <div className="rounded-lg border border-blue-100 bg-blue-50 p-3">
              <p className="text-sm text-blue-700">
                <span className="font-semibold">Tespit edilen ders:</span> {excelData.course_name || '(Bulunamadı)'}
              </p>
            </div>

            {/* Course Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-900 mb-2">Dersi Seçin</label>
              <select
                value={selectedCourseId}
                onChange={(e) => setSelectedCourseId(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-[#10B981] outline-none"
              >
                <option value="">-- Ders Seçin --</option>
                {Array.isArray(coursesData)
                  ? coursesData.map((course) => (
                      <option key={course.id} value={course.id}>
                        {course.name}
                      </option>
                    ))
                  : null}
              </select>
              {!selectedCourseId && excelData.course_name && (
                <p className="text-xs text-gray-500 mt-1">
                  Lütfen "{excelData.course_name}" ile eşleşen dersi seçin
                </p>
              )}
            </div>

            {/* Preview Table */}
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Yüklenecek Öğrenciler ({excelData.students.length})</h3>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-4 py-2 text-left text-gray-700 font-semibold">Öğrenci No</th>
                      <th className="px-4 py-2 text-left text-gray-700 font-semibold">Ad Soyad</th>
                      <th className="px-4 py-2 text-center text-gray-700 font-semibold">Zorunlu</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {excelData.students.slice(0, 10).map((student, idx) => (
                      <tr key={idx} className="hover:bg-gray-50">
                        <td className="px-4 py-2 text-gray-900">{student.student_number}</td>
                        <td className="px-4 py-2 text-gray-900">{student.full_name}</td>
                        <td className="px-4 py-2 text-center text-gray-600">
                          {student.is_mandatory ? 'Evet' : 'Hayır'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {excelData.students.length > 10 && (
                <p className="text-xs text-gray-500 mt-2">... ve {excelData.students.length - 10} daha</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="secondary" onClick={() => setExcelStep(1)}>
                Geri
              </Button>
              <Button
                variant="primary"
                className="bg-[#10B981] hover:bg-[#059669]"
                onClick={handleExcelImport}
                disabled={!selectedCourseId || isImportingExcel}
                loading={isImportingExcel}
              >
                İçeri Aktar
              </Button>
            </div>
          </div>
        )}

        {excelStep === 3 && excelResult && (
          <div className="space-y-4">
            {/* Success Message */}
            <div className="rounded-lg border border-green-100 bg-green-50 p-4">
              <div className="flex flex-col gap-2">
                <p className="text-sm font-semibold text-green-900">
                  ✅ {excelResult.enrolled_count || 0} öğrenci derse eklendi
                </p>
                {excelResult.created_count > 0 && (
                  <p className="text-sm text-green-800">
                    🆕 {excelResult.created_count} yeni öğrenci oluşturuldu (şifre: öğrenci numarası)
                  </p>
                )}
                {excelResult.existing_count > 0 && (
                  <p className="text-sm text-green-800">
                    👥 {excelResult.existing_count} öğrenci zaten sistemdeydi
                  </p>
                )}
              </div>
            </div>

           
            {excelResult.skipped_count > 0 && excelResult.errors && excelResult.errors.length > 0 && (
              <div className="rounded-lg border border-red-100 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-900 mb-2">
                  ❌ {excelResult.skipped_count} öğrenci eklenirken hata oluştu:
                </p>
                <ul className="space-y-1 text-xs text-red-800">
                  {excelResult.errors.map((err, idx) => (
                    <li key={idx}>• {err}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button
                variant="primary"
                className="bg-[#10B981] hover:bg-[#059669]"
                onClick={handleExcelImportClose}
              >
                Kapat
              </Button>
            </div>
          </div>
        )}
      </Modal>
      <Modal isOpen={isBulkOpen} onClose={() => setIsBulkOpen(false)} title="Toplu Öğrenci Yükle" size="lg">
        <div className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm text-gray-600">Şablon dosyayı indirip öğrenci bilgilerini ekleyin.</p>
              <p className="text-xs text-gray-500 mt-1">Zorunlu alanlar: name, email, password</p>
            </div>
            <Button variant="secondary" size="sm" className="gap-2" onClick={handleTemplateDownload}>
              <Download size={14} />
              Şablon İndir
            </Button>
          </div>

          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(event) => {
              const file = event.target.files?.[0];
              setBulkFile(file || null);
              setBulkStudents([]);
              if (file) parseBulkFile(file);
            }}
            className="w-full text-sm text-gray-600 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-gray-700 hover:file:bg-gray-200"
          />

          <div className="rounded-lg border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
            {bulkParsing ? (
              'Dosya okunuyor...'
            ) : bulkStudents.length > 0 ? (
              `${bulkStudents.length} öğrenci satırı hazır.`
            ) : (
              'Henüz dosya seçilmedi.'
            )}
          </div>

          {bulkResult && (
            <div className="rounded-lg border border-green-100 bg-green-50 p-4 text-sm text-green-700">
              {bulkResult.added} öğrenci eklendi, {bulkResult.skipped} atlandı
            </div>
          )}

          <div className="flex gap-3 justify-end">
            <Button variant="secondary" type="button" onClick={() => setIsBulkOpen(false)}>
              Kapat
            </Button>
            <Button
              variant="primary"
              type="button"
              className="bg-[#10B981] hover:bg-[#059669]"
              loading={bulkCreateMutation.isLoading}
              onClick={handleBulkUpload}
              disabled={!bulkFile}
            >
              Yükle
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

const formatDate = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('tr-TR');
};
