import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { WebsiteSettingsProvider } from './context/WebsiteSettingsContext';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { AcademicStructurePage } from './pages/AcademicStructurePage';
import { HODAssignmentPage } from './pages/HODAssignmentPage';
import { StaffPage } from './pages/StaffPage';
import { StudentsPage } from './pages/StudentsPage';
import { SubjectsPage } from './pages/SubjectsPage';
import { AttendancePage } from './pages/AttendancePage';
import { MarksPage } from './pages/MarksPage';
import { StudentSubjectsPage } from './pages/StudentSubjectsPage';
import { WebsiteCustomizationPage } from './pages/WebsiteCustomizationPage';
import { LoadingState } from './components/UIComponents';
import './styles/theme.css';

const queryClient = new QueryClient();

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState message="Authenticating KCET ERP user..." />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
};

const AdminRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading } = useAuth();
  if (loading) return <LoadingState message="Verifying access..." />;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <Navigate to="/" replace />;
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <WebsiteSettingsProvider>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  path="/"
                  element={
                    <ProtectedRoute>
                      <AppLayout />
                    </ProtectedRoute>
                  }
                >
                  <Route index element={<DashboardPage />} />
                  <Route path="academic-structure" element={<AcademicStructurePage />} />
                  <Route path="hod-assignment" element={<HODAssignmentPage />} />
                  <Route path="staff" element={<StaffPage />} />
                  <Route path="students" element={<StudentsPage />} />
                  <Route path="subjects" element={<SubjectsPage />} />
                  <Route path="attendance" element={<AttendancePage />} />
                  <Route path="marks" element={<MarksPage />} />
                  <Route path="my-subjects" element={<StudentSubjectsPage />} />
                  <Route
                    path="website-customization"
                    element={
                      <AdminRoute>
                        <WebsiteCustomizationPage />
                      </AdminRoute>
                    }
                  />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </WebsiteSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
};

export default App;
