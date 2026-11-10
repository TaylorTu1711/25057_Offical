import { Navigate, useLocation } from 'react-router-dom';
import { getPortal, getRole, isLoggedIn } from '../utils/auth';

/** Chỉ user portal dtr_sortmachine (hoặc admin) vào được /dtr/sortmachine. */
export default function DtrPortalRoute({ children }) {
  const location = useLocation();
  if (!isLoggedIn()) return <Navigate to="/login" state={{ from: location }} replace />;
  const portal = getPortal();
  const role = getRole();
  if (role === 'admin' || portal === 'dtr_sortmachine') return children;
  return <Navigate to="/" replace />;
}
