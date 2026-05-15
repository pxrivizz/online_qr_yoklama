const XLSX = require('xlsx');
const bcrypt = require('bcryptjs');

const parseEnrollmentExcel = (buffer) => {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
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

  const students = [];

  // 4. Parse data rows after header
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const student_number = String(row[studentNoIdx] || '').trim();
    const full_name = String(row[nameIdx] || '').trim();
    const mandatoryRaw = String(row[mandatoryIdx] || '').trim().toLowerCase();
    if (!student_number || student_number === 'öğrenci no') continue;
    const is_mandatory = mandatoryRaw.includes('zorunlu') && !mandatoryRaw.includes('alttan');

    students.push({
      student_number,
      full_name,
      is_mandatory
    });
  }

  return { course_name, students };
};

const importEnrollmentFromExcel = async (buffer, courseId, pool) => {
  const { course_name, students } = parseEnrollmentExcel(buffer);

  if (!students || students.length === 0) {
    return { error: 'Excel dosyasından öğrenci bulunamadı', course_id: courseId };
  }

  // Verify course exists using provided courseId
  const courseCheck = await pool.query(
    'SELECT id, name FROM courses WHERE id = $1',
    [courseId]
  );

  if (courseCheck.rows.length === 0) {
    return { error: 'Ders bulunamadı', course_id: courseId };
  }

  let enrolled_count = 0;
  let created_count = 0;
  let existing_count = 0;
  let skipped_count = 0;
  const errors = [];

  for (const student of students) {
    try {
      // Step 1 — Find or create user:
      const findResult = await pool.query(
        'SELECT id FROM users WHERE student_number = $1',
        [student.student_number]
      );

      let studentId;
      if (findResult.rows.length > 0) {
        // Student exists
        studentId = findResult.rows[0].id;
        existing_count++;
      } else {
        // Create new student
        const passwordHash = await bcrypt.hash(student.student_number, 10);
        const email = `${student.student_number}@posta.mu.edu.tr`;
        const name = student.full_name;
        
        const insertResult = await pool.query(
          `INSERT INTO users (name, email, password_hash, role, student_number)
           VALUES ($1, $2, $3, 'student', $4)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
           RETURNING id`,
          [name, email, passwordHash, student.student_number]
        );
        studentId = insertResult.rows[0].id;
        created_count++;
      }

      // Step 2 — Enroll in course:
      await pool.query(
        `INSERT INTO course_students (course_id, student_id, is_mandatory)
         VALUES ($1, $2, $3)
         ON CONFLICT (course_id, student_id) DO UPDATE SET is_mandatory = EXCLUDED.is_mandatory`,
        [courseId, studentId, student.is_mandatory]
      );

      enrolled_count++;
    } catch (error) {
      skipped_count++;
      errors.push(`Öğrenci ${student.student_number} (${student.full_name}) eklenirken hata: ${error.message}`);
    }
  }

  return {
    course_name,
    course_id: courseId,
    enrolled_count,
    created_count,
    existing_count,
    skipped_count,
    errors
  };
};

module.exports = { parseEnrollmentExcel, importEnrollmentFromExcel };
