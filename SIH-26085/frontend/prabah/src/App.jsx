import { Routes, Route } from 'react-router-dom';
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
