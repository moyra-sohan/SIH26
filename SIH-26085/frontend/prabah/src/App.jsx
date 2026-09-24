import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import AuthPage from './pages/AuthPage.jsx';
import Layout from './components/Layout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MapPage from './pages/map.jsx';
import EmergencySupport from './pages/EmergencySupport.jsx';

function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<AuthPage />} />

        {/* Protected routes wrapped in ProtectedRoute and shared Layout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Layout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/map" element={<MapPage />} />
            <Route path="/rainfall" element={<Navigate to="/map?layer=rainfall" replace />} />
            <Route path="/heatmap" element={<Navigate to="/map?layer=heatmap" replace />} />
            <Route path="/water" element={<Navigate to="/map?layer=water" replace />} />
            <Route path="/water-level" element={<Navigate to="/map?layer=water" replace />} />
            <Route path="/roads" element={<Navigate to="/map?layer=roads" replace />} />
            <Route path="/flood-map" element={<Navigate to="/map?layer=all" replace />} />
            <Route path="/emergency" element={<EmergencySupport />} />
          </Route>
        </Route>

        {/* Fallback route */}
        <Route path="*" element={<AuthPage />} />
      </Routes>
    </AuthProvider>
  );
}

export default App;
