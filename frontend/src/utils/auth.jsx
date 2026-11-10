export const saveToken = (token) => localStorage.setItem('token', token);
export const getToken = () => localStorage.getItem('token');

/** Cookie proxy DTR — phải xóa khi login/logout kẻo / bị Nginx proxy sang máy sort. */
export const clearDtrMachineCookie = () => {
  try {
    document.cookie = 'dtr_machine=; Path=/; Max-Age=0; SameSite=Lax';
    document.cookie = 'dtr_machine=; Path=/; Max-Age=0; SameSite=Lax; Secure';
  } catch {
    /* ignore */
  }
};

export const logout = () => {
  clearDtrMachineCookie();
  localStorage.removeItem('token');
  localStorage.removeItem('role');
  localStorage.removeItem('email');
  localStorage.removeItem('portal');
  localStorage.removeItem('redirectPath');
  localStorage.removeItem('locations');
};
export const isLoggedIn = () => !!localStorage.getItem('token');

export const saveUserSession = ({ role, portal, redirectPath, locations }) => {
  if (role) localStorage.setItem('role', role);
  localStorage.setItem('portal', portal || 'default');
  if (redirectPath) localStorage.setItem('redirectPath', redirectPath);
  else localStorage.removeItem('redirectPath');
  if (locations) localStorage.setItem('locations', JSON.stringify(locations));
};

/** Đường dẫn sau login theo portal (ưu tiên hơn redirectPath cũ/sai). */
export const getPostLoginPath = (portal, role = 'factory') => {
  if (portal === 'dtr_sortmachine') return '/dtr/sortmachine';
  if (portal === 'mida_cnc' && role !== 'admin') return '/mida/cnc';
  return '/';
};

export const getPortal = () => localStorage.getItem('portal') || 'default';
export const getRole = () => localStorage.getItem('role') || 'factory';
export const isMaintenanceRole = () => getRole() === 'maintenance';
export const isAdminRole = () => getRole() === 'admin';
export const getLocations = () => {
  try {
    const raw = localStorage.getItem('locations');
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
};
export const authHeaders = () => {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
};
