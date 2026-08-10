const ExcelJS = require('exceljs');


const parseEnrollmentExcel = async (buffer) => {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet(1);
  if (!worksheet) return { course_name: '', students: [] };

  const rows = [];
  const rowLimit = Math.min(worksheet.rowCount, 2001);
  for (let rowNumber = 1; rowNumber <= rowLimit; rowNumber++) {
    const row = worksheet.getRow(rowNumber);
    const values = [];
    for (let column = 1; column <= worksheet.columnCount; column++) values.push(row.getCell(column).text || '');
    rows.push(values);
  }

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
    if (students.length >= 1000) throw new Error('Spreadsheet row limit exceeded');
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
  const { course_name, students } = await parseEnrollmentExcel(buffer);

  if (!students || students.length === 0) {
    return { error: 'Excel dosyasından öğrenci bulunamadı', course_id: courseId };
  }

  const client = await pool.connect();
  let transactionStarted = false;
  let courseCheck;
  try {
    courseCheck = await client.query('SELECT id, name FROM courses WHERE id = $1', [courseId]);
  } catch (error) {
    client.release();
    throw error;
  }

  if (courseCheck.rows.length === 0) {
    client.release();
    return { error: 'Ders bulunamadı', course_id: courseId };
  }

  let enrolled_count = 0;
  let created_count = 0;
  let existing_count = 0;
  let skipped_count = 0;
  const errors = [];

  try {
    await client.query('BEGIN');
    transactionStarted = true;
    const numbers = students.map((student) => student.student_number);
    const existingUsers = await client.query('SELECT id, student_number FROM users WHERE student_number = ANY($1::varchar[])', [numbers]);
    const usersByNumber = new Map(existingUsers.rows.map((row) => [row.student_number, row.id]));

    for (const student of students) {
      const studentId = usersByNumber.get(student.student_number);
      if (studentId) {
        await client.query(
          `INSERT INTO course_students (course_id, student_id, is_mandatory, enrollment_type)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (course_id, student_id) DO UPDATE SET is_mandatory = EXCLUDED.is_mandatory, enrollment_type = EXCLUDED.enrollment_type`,
          [courseId, studentId, student.is_mandatory, student.is_mandatory ? 'zorunlu' : 'alttan']
        );
        existing_count++;
        enrolled_count++;
      } else {
        await client.query(
          `INSERT INTO pending_enrollments (course_id, student_number, student_name, enrollment_type, is_mandatory)
           VALUES ($1, $2, $3, $4, $5)
           ON CONFLICT (course_id, student_number) DO UPDATE SET student_name = EXCLUDED.student_name, enrollment_type = EXCLUDED.enrollment_type, is_mandatory = EXCLUDED.is_mandatory`,
          [courseId, student.student_number, student.full_name, student.is_mandatory ? 'zorunlu' : 'alttan', student.is_mandatory]
        );
        created_count++;
      }
    }
    await client.query('COMMIT');
    transactionStarted = false;
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    console.error('Enrollment import failed:', error.code || error.name || 'UNKNOWN');
    skipped_count = students.length;
    errors.push('Öğrenci listesi içe aktarılamadı');
  } finally {
    client.release();
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
