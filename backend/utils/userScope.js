import pool from '../db.js';

export const PORTALS = {
  DEFAULT: 'default',
  MIDA_CNC: 'mida_cnc',
};

export async function getUserAllowedLocations(userId, role) {
  if (role === 'admin') return null;
  const { rows } = await pool.query(
    'SELECT location FROM user_locations WHERE user_id = $1 ORDER BY location',
    [userId],
  );
  return rows.map((r) => r.location);
}

export async function loadUserScope(userId) {
  const { rows } = await pool.query(
    'SELECT id, email, role, portal FROM users WHERE id = $1',
    [userId],
  );
  const user = rows[0];
  if (!user) return null;
  const locations = await getUserAllowedLocations(user.id, user.role);
  return {
    id: user.id,
    email: user.email,
    role: user.role || 'factory',
    portal: user.portal || PORTALS.DEFAULT,
    locations,
  };
}
