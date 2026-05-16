-- QR-Based Attendance System Database Schema

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'teacher', 'student')),
  student_number VARCHAR(20),
  avatar_url VARCHAR(255),
  created_at TIMESTAMP DEFAULT now()
);

-- Add avatar_url column if not exists (for existing databases)
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url VARCHAR(255);

-- Rename password_hash to password if it exists (for existing databases)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
    ALTER TABLE users RENAME COLUMN password_hash TO password;
  END IF;
END $$;

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
  created_at TIMESTAMP DEFAULT now(),
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS course_students (
  course_id UUID NOT NULL,
  student_id UUID NOT NULL,
  enrolled_at TIMESTAMP DEFAULT now(),
  PRIMARY KEY (course_id, student_id),
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
);

ALTER TABLE course_students ADD COLUMN IF NOT EXISTS is_mandatory BOOLEAN DEFAULT true;

-- Add total planned sessions for courses
ALTER TABLE courses ADD COLUMN IF NOT EXISTS total_sessions_planned INTEGER DEFAULT 0;

-- Attendance Sessions table
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  qr_token VARCHAR(255) UNIQUE NOT NULL,
  token_expires_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP DEFAULT now(),
  ended_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Attendances table
CREATE TABLE IF NOT EXISTS attendances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  student_id UUID NOT NULL,
  marked_at TIMESTAMP DEFAULT now(),
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

INSERT INTO users (name, email, password, role)
VALUES ('Halil Çiftçi', 'halilciftci@posta.mu.edu.tr', 'halil2006', 'admin')
ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;
