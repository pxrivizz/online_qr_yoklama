import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { ProtectedRoute } from './components/layout/ProtectedRoute';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

// Pages
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Courses } from './pages/Courses';
import { CourseDetail } from './pages/CourseDetail';
import { ActiveSession } from './pages/ActiveSession';
import { Users } from './pages/Users';
import { MyAttendance } from './pages/MyAttendance';
import { StudentDashboard } from './pages/student/StudentDashboard';
import { QRScanner } from './pages/student/QRScanner';
import { ProfileScreen } from './pages/student/ProfileScreen';
import { TeacherDashboard } from './pages/teacher/TeacherDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />

        {/* Redirect root to dashboard or login */}
        <Route path="/" element={<Navigate to="/login" replace />} />

        {/* Protected Routes */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/courses"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <Courses />
            </ProtectedRoute>
          }
        />

        <Route
          path="/courses/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <CourseDetail />
            </ProtectedRoute>
          }
        />

        <Route
          path="/sessions/:id"
          element={
            <ProtectedRoute allowedRoles={['admin', 'teacher']}>
              <ActiveSession />
            </ProtectedRoute>
          }
        />

        <Route
          path="/users"
          element={
            <ProtectedRoute allowedRoles={['admin']}>
              <Users />
            </ProtectedRoute>
          }
        />

        <Route
          path="/my-attendance"
          element={
            <ProtectedRoute allowedRoles={['student']}>
              <MyAttendance />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute allowedRoles={['student']} hideLayout={true}>
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/scan"
          element={
            <ProtectedRoute allowedRoles={['student']} hideLayout={true}>
              <QRScanner />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student/profile"
          element={
            <ProtectedRoute allowedRoles={['student']} hideLayout={true}>
              <ProfileScreen />
            </ProtectedRoute>
          }
        />

        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute allowedRoles={['teacher']}>
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
