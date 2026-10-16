import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { HealthDataProvider } from './context/HealthDataContext';
import { Shell } from './components/layout/Shell';
import { AuthModal } from './components/auth/AuthModal';

// Public components
import { PublicLandingPage } from './components/public/PublicLandingPage';
import { PrivacyPolicyPage, TermsOfUsePage } from './components/public/LegalPages';

// Auth & Guards
import { LoginPage } from './components/auth/LoginPage';
import { RegisterPage } from './components/auth/RegisterPage';
import { RequireAuth } from './components/auth/RequireAuth';
import { RequireAdmin } from './components/admin/RequireAdmin';

// Patient Workspace Screens
import { OverviewScreen } from './components/screens/OverviewScreen';
import { UploadScreen } from './components/screens/UploadScreen';
import { ReviewScreen } from './components/screens/ReviewScreen';
import { TimelineScreen } from './components/screens/TimelineScreen';
import { TrendsScreen } from './components/screens/TrendsScreen';
import { DataQualityScreen } from './components/screens/DataQualityScreen';
import { DocumentsScreen } from './components/screens/DocumentsScreen';
import { PatientSettingsScreen } from './components/screens/PatientSettingsScreen';

// Admin Console
import { AdminConsole } from './components/admin/AdminConsole';

const PatientWorkspaceLayout: React.FC = () => {
  return (
    <Shell>
      <Outlet />
    </Shell>
  );
};

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <HealthDataProvider>
          <Routes>
            {/* Public Marketing & Legal Pages */}
            <Route path="/" element={<PublicLandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/privacy" element={<PrivacyPolicyPage />} />
            <Route path="/terms" element={<TermsOfUsePage />} />

            {/* Protected Patient Workspace */}
            <Route
              path="/app"
              element={
                <RequireAuth>
                  <PatientWorkspaceLayout />
                </RequireAuth>
              }
            >
              <Route index element={<OverviewScreen />} />
              <Route path="overview" element={<OverviewScreen />} />
              <Route path="upload" element={<UploadScreen />} />
              <Route path="review" element={<ReviewScreen />} />
              <Route path="timeline" element={<TimelineScreen />} />
              <Route path="trends" element={<TrendsScreen />} />
              <Route path="data-quality" element={<DataQualityScreen />} />
              <Route path="documents" element={<DocumentsScreen />} />
              <Route path="settings" element={<PatientSettingsScreen />} />
            </Route>

            {/* Protected Admin Console */}
            <Route
              path="/admin/*"
              element={
                <RequireAdmin>
                  <AdminConsole />
                </RequireAdmin>
              }
            />

            {/* Catch-all redirect to public landing */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>

          {/* Auth modal preserved for interactive triggers */}
          <AuthModal />
        </HealthDataProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
