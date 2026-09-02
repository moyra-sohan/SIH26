import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loader2 } from 'lucide-react';

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        width: '100vw',
        background: '#f8fafc',
        gap: '12px',
        color: '#475569',
        fontFamily: 'inherit'
      }}>
        <Loader2 size={36} className="spin" style={{ animation: 'spin 1s linear infinite', color: '#0284c7' }} />
        <p style={{ fontSize: '0.95rem', fontWeight: 500 }}>Verifying session...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
