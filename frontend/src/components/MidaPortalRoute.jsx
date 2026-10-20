import { Navigate, useLocation } from 'react-router-dom';
import { getPortal, getRole, isLoggedIn } from '../utils/auth';

export default function MidaPortalRoute({ children }) {
  const location = useLocation();
  if (!isLoggedIn()) return <Navigate to="/login" state={{ from: location }} replace />;
  const portal = getPortal();
  const role = getRole();
  if (role === 'admin' || portal === 'mida_cnc') return children;
  return <Navigate to="/" replace />;
}

export function DefaultPortalRoute({ children }) {
  const location = useLocation();
  if (!isLoggedIn()) return <Navigate to="/login" state={{ from: location }} replace />;
  const portal = getPortal();
  const role = getRole();
  if (portal === 'mida_cnc' && role !== 'admin') return <Navigate to="/mida/cnc" replace />;
  return children;
}
