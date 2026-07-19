import { loadUserScope, PORTALS } from '../utils/userScope.js';

export async function attachUserScope(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    req.userScope = await loadUserScope(req.user.id);
    if (!req.userScope) {
      return res.status(401).json({ error: 'User not found' });
    }
    next();
  } catch (err) {
    console.error('attachUserScope error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
}

export function requirePortal(...allowedPortals) {
  return (req, res, next) => {
    const { role, portal } = req.userScope || {};
    if (role === 'admin') return next();
    if (allowedPortals.includes(portal)) return next();
    return res.status(403).json({ error: 'Access denied for this portal' });
  };
}

export function getPostLoginPath(portal, role) {
  if (portal === PORTALS.MIDA_CNC && role !== 'admin') {
    return '/mida/cnc';
  }
  return '/';
}
