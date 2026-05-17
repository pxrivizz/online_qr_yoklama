import * as XLSX from 'xlsx';
import api from './axios';

export const parseEnrollmentExcel = async (file) => {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = XLSX.read(arrayBuffer, { type: 'array' });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Find course name (first non-empty, non-header row)
  let course_name = '';
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const row = rows[i];
    const first = String(row[0] || '').trim();
    if (first && !first.toLowerCase().includes('no') && row.slice(1, 4).every(c => !c)) {
      course_name = first;
      break;
    }
  }

  // Find header row
  let headerIndex = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i].some(c => String(c).toLowerCase().includes('öğrenci no'))) {
      headerIndex = i;
      break;
    }
  }
  if (headerIndex === -1) headerIndex = 1;

  // Map columns
  let studentNoIdx = 1, nameIdx = 2, statusIdx = -1;
  rows[headerIndex]?.forEach((cell, idx) => {
    const v = String(cell || '').toLowerCase().trim();
    if (v.includes('öğrenci no')) studentNoIdx = idx;
    if (v.includes('soyadı') || v.includes('adı soyadı') || v.includes('ad soyad')) nameIdx = idx;
    if (v.includes('zorunlu') || v.includes('durum') || v.includes('alış') || v.includes('status') || v.includes('ders türü') || v.includes('kayıt türü')) statusIdx = idx;
  });

  /**
   * Determine enrollment type from the raw cell value.
   * Returns: 'zorunlu' | 'secmeli' | 'alttan'
   */
  const parseEnrollmentType = (raw) => {
    const val = String(raw || '').trim().toLowerCase();
    if (!val) return 'zorunlu'; // Default fallback
    if (val.includes('alttan') || val.includes('tekrar')) return 'alttan';
    if (val.includes('seçmeli') || val.includes('secmeli') || val.includes('elective')) return 'secmeli';
    // 'zorunlu', 'mandatory', or any other value defaults to zorunlu
    return 'zorunlu';
  };

  // Parse students
  const students = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const student_number = String(row[studentNoIdx] || '').trim();
    const full_name = String(row[nameIdx] || '').trim();
    if (!student_number || student_number === 'öğrenci no') continue;

    const enrollment_type = statusIdx >= 0 ? parseEnrollmentType(row[statusIdx]) : 'zorunlu';
    const is_mandatory = enrollment_type === 'zorunlu';

    students.push({ student_number, full_name, is_mandatory, enrollment_type });
  }

  return { course_name, students };
};

/**
 * Upload Excel file and import student/:courseId
 */
export const importEnrollmentExcel = async (file, courseId) => {
  const formData = new FormData();
  formData.append('file', file);

  return api.post(`/api/attendance/import/excel/${courseId}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const importAPI = {
  parseEnrollmentExcel,
  importEnrollmentExcel,
};
