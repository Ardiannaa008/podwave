import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

// Wraps a page and redirects to /login if there's no authenticated user.
// Usage: <ProtectedRoute><Library /></ProtectedRoute>
export default function ProtectedRoute({ children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
