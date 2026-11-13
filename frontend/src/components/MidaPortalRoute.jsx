import { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { clearDtrMachineCookie, getPortal, getRole, isLoggedIn } from '../utils/auth';

export default function MidaPortalRoute({ children }) {
  const location = useLocation();
  useEffect(() => {
    clearDtrMachineCookie();
  }, []);
  if (!isLoggedIn()) return <Navigate to="/login" state={{ from: location }} replace />;
  const portal = getPortal();
  const role = getRole();
  if (role === 'admin' || portal === 'mida_cnc') return children;
  return <Navigate to="/" replace />;
}

export function DefaultPortalRoute({ children }) {
  const location = useLocation();
  useEffect(() => {
    // Tránh cookie DTR (nếu Nginx cũ còn cookie-proxy) phá Plenma home
    clearDtrMachineCookie();
  }, []);
  if (!isLoggedIn()) return <Navigate to="/login" state={{ from: location }} replace />;
  const portal = getPortal();
  const role = getRole();
  // Portal Sort DTR (kể cả admin) không vào trang SCADA Plenma
  if (portal === 'dtr_sortmachine') {
    return <Navigate to="/dtr/sortmachine" replace />;
  }
  if (portal === 'mida_cnc') return <Navigate to="/mida/cnc" replace />;
  return children;
}
