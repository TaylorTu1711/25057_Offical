import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { loadUserScope } from '../utils/userScope.js';
import { getPostLoginPath } from '../middleware/portalMiddleware.js';

const JWT_SECRET = process.env.JWT_SECRET;

export const register = async (req, res) => {
  const { email, password } = req.body;
  try {
    const hashed = await bcrypt.hash(password, 10);
    await pool.query(
      'INSERT INTO users (email, password, role, portal) VALUES ($1, $2, $3, $4)',
      [email, hashed, 'factory', 'default'],
    );
    res.status(201).json({ message: 'User registered' });
  } catch {
    res.status(400).json({ error: 'Email already in use' });
  }
};

export const login = async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(401).json({ error: 'Invalid credentials' });

  const role = user.role || 'factory';
  const portal = user.portal || 'default';
  const signOptions = {};
  const expiresIn = process.env.JWT_EXPIRES_IN;
  if (expiresIn) signOptions.expiresIn = expiresIn;

  const token = jwt.sign(
    { id: user.id, email: user.email, role, portal },
    JWT_SECRET || 'secret_key',
    signOptions,
  );

  const scope = await loadUserScope(user.id);
  res.json({
    token,
    role,
    portal,
    redirectPath: getPostLoginPath(portal, role),
    locations: scope?.locations ?? [],
  });
};

export const getCurrentUser = async (req, res) => {
  try {
    const scope = await loadUserScope(req.user.id);
    if (!scope) return res.status(404).json({ error: 'User not found' });
    res.json({
      id: scope.id,
      email: scope.email,
      role: scope.role,
      portal: scope.portal,
      locations: scope.locations,
      redirectPath: getPostLoginPath(scope.portal, scope.role),
    });
  } catch (err) {
    console.error('getCurrentUser error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

export const logout = async (req, res) => {
  try {
    if (!req.headers.authorization) return res.status(400).json({ error: 'No token provided' });
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
};
