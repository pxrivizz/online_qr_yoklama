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
  let studentNoIdx = 1, nameIdx = 2, mandatoryIdx = 3;
  rows[headerIndex]?.forEach((cell, idx) => {
    const v = String(cell || '').toLowerCase().trim();
    if (v.includes('öğrenci no')) studentNoIdx = idx;
    if (v.includes('soyadı') || v.includes('adı soyadı') || v.includes('ad soyad')) nameIdx = idx;
    if (v.includes('zorunlu') || v.includes('durum') || v.includes('alış')) mandatoryIdx = idx;
  });

  // Parse students
  const students = [];
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    const student_number = String(row[studentNoIdx] || '').trim();
    const full_name = String(row[nameIdx] || '').trim();
    const mandatoryRaw = String(row[mandatoryIdx] || '').trim().toLowerCase();
    if (!student_number || student_number === 'öğrenci no') continue;
    const is_mandatory = mandatoryRaw.includes('zorunlu') && !mandatoryRaw.includes('alttan');
    students.push({ student_number, full_name, is_mandatory });
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
