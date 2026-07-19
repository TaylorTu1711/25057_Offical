export const saveToken = (token) => localStorage.setItem('token', token);
export const getToken = () => localStorage.getItem('token');
export const logout = () => {
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
  if (portal) localStorage.setItem('portal', portal);
  if (redirectPath) localStorage.setItem('redirectPath', redirectPath);
  if (locations) localStorage.setItem('locations', JSON.stringify(locations));
};

export const getPortal = () => localStorage.getItem('portal') || 'default';
export const getRole = () => localStorage.getItem('role') || 'factory';
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
