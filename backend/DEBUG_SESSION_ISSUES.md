# Debug Guide: Silent Database State Failure in `getActiveSessions`

## 🔴 Problem Statement
`getActiveSessions` returns `[]` even though the frontend and routing are correct. This indicates a **silent database state failure**.

## ✅ Two Fixes Implemented

### FIX #1: `startSession` - UPSERT Logic (Teachers)

**Location:** [sessionController.js](src/controllers/sessionController.js) - `startSession` function

**Previous Issue:** Simple INSERT fails silently if session row already exists

**Solution:** Use PostgreSQL UPSERT pattern

```javascript
const upsertQuery = `
  INSERT INTO attendance_sessions 
    (id, course_id, teacher_id, session_number, qr_token, token_expires_at, is_active, started_at)
  VALUES 
    ($1, $2, $3, $4, $5, $6, true, now())
  ON CONFLICT (course_id, session_number) DO UPDATE SET
    qr_token = $5,
    token_expires_at = $6,
    is_active = true,
    started_at = now(),
    ended_at = null,
    teacher_id = $3
  RETURNING id, course_id, teacher_id, session_number, qr_token, token_expires_at, started_at, is_active
`;
```

**What It Does:**
- **If new (course_id, session_number):** INSERTS a new session with `is_active = true`
- **If exists:** UPDATES the session, ensuring `is_active = true` (even if it was previously false)
- **Prevents silent failures:** No more "UPDATE affected 0 rows" scenarios

**Key Changes:**
- ✅ Removed the "check for active session first" pattern (was ineffective)
- ✅ Now uses unique constraint on (course_id, session_number) for proper UPSERT
- ✅ Always sets `started_at = now()` when toggling to active
- ✅ Clears `ended_at` when reactivating

---

### FIX #2: `getActiveSessions` - Aggressive Logging (Students)

**Location:** [sessionController.js](src/controllers/sessionController.js) - `getActiveSessions` function

**Previous Issue:** No visibility into WHY the query returns empty array

**Solution:** Added 3-level diagnostic logging for students

```javascript
// LOG 1: Check if ANY sessions with is_active = true exist in database
const debugLog1Query = `SELECT * FROM attendance_sessions WHERE is_active = true`;

// LOG 2: Check if THIS STUDENT is enrolled in ANY courses
const debugLog2Query = `SELECT course_id FROM course_students WHERE student_id = $1`;

// LOG 3: Cross-check - sessions in this student's enrolled courses (any state)
const debugLog3Query = `
  SELECT s.id, s.course_id, s.session_number, s.is_active, s.qr_token
  FROM attendance_sessions s
  JOIN course_students cs ON s.course_id = cs.course_id
  WHERE cs.student_id = $1
`;
```

**Console Output Format:**

```
╔════════════════════════════════════════════════════════════════╗
║ [DEBUG LOG 1] ALL SESSIONS WITH is_active = true IN DATABASE   ║
╚════════════════════════════════════════════════════════════════╝
❌ NO ACTIVE SESSIONS FOUND IN DATABASE!
👉 This means the teacher NEVER clicked "Start Session" or the UPDATE failed silently.

╔════════════════════════════════════════════════════════════════╗
║ [DEBUG LOG 2] COURSES THIS STUDENT IS ENROLLED IN              ║
╚════════════════════════════════════════════════════════════════╝
❌ STUDENT NOT ENROLLED IN ANY COURSES!
👉 This explains why getActiveSessions returns [].
👉 The student needs to be added to course_students table.

╔════════════════════════════════════════════════════════════════╗
║ [DEBUG LOG 3] SESSIONS IN STUDENT'S ENROLLED COURSES (ANY STATE)║
╚════════════════════════════════════════════════════════════════╝
✓ Found 2 session(s) in student's courses:
  [1] Session ID: abc-123
      Course ID: xyz-789
      is_active: false
```

**What It Debugs:**

| Log | Scenario | Resolution |
|-----|----------|-----------|
| **LOG 1** | `❌ NO ACTIVE SESSIONS` | Teacher never started session, or startSession UPSERT failed |
| **LOG 2** | `❌ NOT ENROLLED IN ANY COURSES` | Use admin panel to add student to course_students |
| **LOG 3** | `Found sessions but is_active: false` | Session exists but teacher never activated it (UPSERT fix helps here) |

---

## 🗄️ Database Schema Updates

**Location:** [schema.sql](src/models/schema.sql)

### Added to `attendance_sessions` Table:

```sql
CREATE TABLE IF NOT EXISTS attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL,
  teacher_id UUID NOT NULL,
  session_number INTEGER,  -- ✅ ADDED
  qr_token VARCHAR(255) UNIQUE NOT NULL,
  token_expires_at TIMESTAMP NOT NULL,
  started_at TIMESTAMP DEFAULT now(),
  ended_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (teacher_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE (course_id, session_number)  -- ✅ ADDED for UPSERT
);
```

### Indexes Added:
```sql
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_course_session 
  ON attendance_sessions(course_id, session_number);
```

### Migration Script (for existing databases):
```sql
-- Ensure session_number column exists
ALTER TABLE attendance_sessions ADD COLUMN IF NOT EXISTS session_number INTEGER;

-- Add unique constraint for UPSERT
DO $$
BEGIN
  ALTER TABLE attendance_sessions 
    ADD CONSTRAINT unique_course_session UNIQUE (course_id, session_number);
EXCEPTION WHEN duplicate_object THEN
  -- Constraint already exists, ignore
END $$;
```

---

## 🧪 Testing Workflow

### Step 1: Verify Schema
```bash
# Check if session_number column exists
psql -U user -d qr_attend -c "
  SELECT column_name 
  FROM information_schema.columns 
  WHERE table_name = 'attendance_sessions' 
  AND column_name = 'session_number';
"

# Check unique constraint
psql -U user -d qr_attend -c "
  SELECT constraint_name 
  FROM information_schema.table_constraints 
  WHERE table_name = 'attendance_sessions' 
  AND constraint_type = 'UNIQUE';
"
```

### Step 2: Test UPSERT (Teacher)

**First call (INSERT):**
```bash
curl -X POST http://localhost:5000/api/sessions/start \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"course_id":"course-123","session_number":1}'
```

**Check console for:**
```
[UPSERT DEBUG] Executing UPSERT with: {
  sessionId: '...',
  course_id: 'course-123',
  session_number: 1,
  teacher_id: 'teacher-456'
}

[UPSERT DEBUG] UPSERT result: {
  rowCount: 1,
  returnedSession: { id: '...', is_active: true, ... }
}
```

**Second call (same course_id + session_number):**
```bash
# Should UPDATE (not fail), keeping same session ID but new QR token
curl -X POST http://localhost:5000/api/sessions/start \
  -H "Authorization: Bearer TEACHER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"course_id":"course-123","session_number":1}'
```

### Step 3: Test Logging (Student)

```bash
curl -X GET http://localhost:5000/api/sessions/active \
  -H "Authorization: Bearer STUDENT_TOKEN"
```

**Check console for:** All 3 DEBUG LOGs with specific indicators (✓ or ❌)

---

## 🔍 Debugging Decision Tree

```
getActiveSessions returns []
    ↓
Check Console Logs
    ├─ LOG 1: ❌ NO ACTIVE SESSIONS
    │   ├─ Check LOG 3: Does teacher's course have ANY sessions?
    │   │   ├─ No → Teacher never created session
    │   │   │   └─ FIX: Run POST /sessions/start from teacher
    │   │   └─ Yes, but all is_active:false → UPSERT fixed this
    │   │       └─ Run POST /sessions/start again (will UPDATE)
    │   └─ Check startSession logs for UPSERT errors
    │
    ├─ LOG 2: ❌ NOT ENROLLED IN ANY COURSES
    │   └─ FIX: Add student to course_students table
    │       INSERT INTO course_students (course_id, student_id) 
    │       VALUES ('course-123', 'student-456');
    │
    └─ LOG 3: Found sessions but is_active:false
        └─ Sessions exist but never activated
            └─ FIX: Run POST /sessions/start (UPSERT will activate)
```

---

## 📋 Summary of Changes

| File | Change | Purpose |
|------|--------|---------|
| `sessionController.js` | Replaced INSERT with UPSERT in `startSession` | Guarantee sessions are created/activated |
| `sessionController.js` | Added 3-level logging to `getActiveSessions` | Identify root cause of empty array |
| `schema.sql` | Added `session_number` column | Support UPSERT uniqueness |
| `schema.sql` | Added UNIQUE(course_id, session_number) | Enable UPSERT to work correctly |
| `schema.sql` | Added migration script | Ensure existing databases are updated |

---

## 🚀 Next Steps

1. **Restart backend** to apply updated code
2. **Run schema migrations** if using an existing database
3. **Test UPSERT** by calling `startSession` twice with same course_id + session_number
4. **Monitor console logs** when student calls `getActiveSessions` to verify 3 LOGs appear
5. **Check decision tree** to identify which scenario applies (A or B)
