import { Routes, Route } from 'react-router-dom';
import AuthPage from './pages/AuthPage.jsx';
import Layout from './components/Layout.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import MapPage from './pages/map.jsx';

function App() {
  return (
    <Routes>
      <Route path="/" element={<AuthPage />} />

      {/* All pages inside the shared Layout (sidebar + header) */}
      <Route element={<Layout />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/map" element={<MapPage />} />
      </Route>
    </Routes>
  );
}

export default App;
