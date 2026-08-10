-- QR-Based Attendance System Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255),
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  student_number VARCHAR(20),
  avatar_url VARCHAR(255),
  auth_provider VARCHAR(20) DEFAULT 'local',
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add avatar_url column if not exists (for existing databases)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);

-- Add auth_provider column if not exists (for existing databases)
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local';

-- Migrate legacy password_hash installations and allow NULL for Google OAuth users.
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(255);
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
    UPDATE users SET password = COALESCE(password, password_hash);
    ALTER TABLE users DROP COLUMN password_hash;
  END IF;
END $$;
ALTER TABLE users ALTER COLUMN password DROP NOT NULL;

-- Courses table
CREATE TABLE IF NOT EXISTS courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(150) NOT NULL,
  code VARCHAR(20) UNIQUE NOT NULL,
  teacher_id UUID NOT NULL,
  allowed_ssid VARCHAR(100),
  allowed_ip_range VARCHAR(50),
  allowed_latitude DECIMAL(10, 8),
  allowed_longitude DECIMAL(11, 8),
  allowed_radius_meters INTEGER DEFAULT 100,
  created_at TIMESTAMPTZ DEFAULT now(),
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_students (
  course_id UUID NOT NULL,
  student_id UUID NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (course_id, student_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE course_students ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT true;
ALTER TABLE course_students ADD COLUMN IF NOT EXISTS enrollment_type VARCHAR(20) DEFAULT 'zorunlu';

-- Add total planned sessions for courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_sessions_planned INTEGER DEFAULT 0;

-- Attendance Sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  session_number INTEGER,
  qr_token TEXT UNIQUE NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ DEFAULT now(),
  ended_at TIMESTAMPTZ,
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Fix qr_token length for existing databases
ALTER TABLE attendance_sessions ALTER COLUMN qr_token TYPE TEXT;

-- Add session_number column if not exists (for existing databases)
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS session_number INTEGER;


-- Attendances table
CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  marked_at TIMESTAMPTZ DEFAULT now(),
  student_ip VARCHAR(45),
  student_latitude DECIMAL(10, 8),
  student_longitude DECIMAL(11, 8),
  is_valid BOOLEAN DEFAULT true,
  rejection_reason VARCHAR(255),
  UNIQUE (session_id, student_id),
  FOREIGN KEY (session_id) REFERENCES attendance_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_courses_teacher_id ON courses(teacher_id);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_qr_token ON attendance_sessions(qr_token);
CREATE INDEX IF NOT EXISTS idx_attendances_session_id ON attendances(session_id);
CREATE INDEX IF NOT EXISTS idx_attendances_student_id ON attendances(student_id);
CREATE INDEX IF NOT EXISTS idx_sessions_course_active ON attendance_sessions(course_id, is_active);
WITH ranked_active AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY course_id ORDER BY started_at DESC, id DESC) AS row_number
  FROM attendance_sessions WHERE is_active = true
)
UPDATE attendance_sessions SET is_active = false, ended_at = COALESCE(ended_at, now())
WHERE id IN (SELECT id FROM ranked_active WHERE row_number > 1);
CREATE UNIQUE INDEX IF NOT EXISTS idx_one_active_session_per_course ON attendance_sessions(course_id) WHERE is_active = true;
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_course_number_unique ON attendance_sessions(course_id, session_number) WHERE session_number IS NOT NULL AND qr_token NOT LIKE 'manual_%';
CREATE INDEX IF NOT EXISTS idx_sessions_course_started_at ON attendance_sessions(course_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_attendances_student_marked_at ON attendances(student_id, marked_at DESC);

-- Unique constraint on student_number (only for non-null values)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_student_number_unique ON users(student_number) WHERE student_number IS NOT NULL;

-- Pending enrollments: holds course enrollments for students who haven't registered yet.
-- When a teacher uploads an Excel list and the student_number doesn't match any registered user,
-- the enrollment is stored here. When the student later registers (provides their student_number),
-- these rows are resolved into real course_students records and deleted from this table.
CREATE TABLE IF NOT EXISTS pending_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  student_number VARCHAR(20) NOT NULL,
  student_name VARCHAR(100),
  enrollment_type VARCHAR(20) DEFAULT 'zorunlu',
  is_mandatory BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (course_id, student_number),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE
);

-- Migrate only legacy timezone-less columns; do not shift new TIMESTAMPTZ installations.
DO $$
DECLARE
  target RECORD;
  column_type TEXT;
BEGIN
  FOR target IN SELECT * FROM (VALUES
    ('users', 'created_at'), ('courses', 'created_at'), ('course_students', 'enrolled_at'),
    ('attendance_sessions', 'token_expires_at'), ('attendance_sessions', 'started_at'),
    ('attendance_sessions', 'ended_at'), ('attendances', 'marked_at'),
    ('pending_enrollments', 'created_at')
  ) AS columns_to_migrate(table_name, column_name)
  LOOP
    SELECT c.data_type INTO column_type FROM information_schema.columns c
      WHERE c.table_schema = 'public' AND c.table_name = target.table_name AND c.column_name = target.column_name;
    IF column_type = 'timestamp without time zone' THEN
      EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE TIMESTAMPTZ USING %I AT TIME ZONE ''UTC''',
        target.table_name, target.column_name, target.column_name);
    END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_pending_enrollments_student_number ON pending_enrollments(student_number);
