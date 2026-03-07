import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function AdminRoute({ children }) {
  const { hasToken, isAdmin, user } = useAuth();

  if (!hasToken) return <Navigate to="/login" replace />;
  if (hasToken && user === null) return <div className="loading">Loading...</div>;
  if (!isAdmin) return <Navigate to="/log" replace />;
  return children;
}
