/**
 * Tạo / cập nhật 2 tài khoản portal Plenma (trang / → /machines/:id).
 *
 *   node backend/scripts/create-plenma-users.js
 *
 *   admin@gmail.com / admin@gmail.com  — role admin, thêm/xóa/sửa máy
 *   plenma@gmail.com / plenma@gmail.com — role factory, chỉ xem
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { migrateUserAccessSchema } from '../utils/dbMigrate.js';
import { PORTALS } from '../utils/userScope.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const USERS = [
  {
    email: process.env.PLENMA_ADMIN_EMAIL || 'admin@gmail.com',
    password: process.env.PLENMA_ADMIN_PASSWORD || 'admin@gmail.com',
    role: 'admin',
  },
  {
    email: process.env.PLENMA_USER_EMAIL || 'plenma@gmail.com',
    password: process.env.PLENMA_USER_PASSWORD || 'plenma@gmail.com',
    role: 'factory',
  },
];

async function upsertUser({ email, password, role }) {
  const hashed = await bcrypt.hash(password, 10);
  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  let userId;
  let created = false;

  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await pool.query(
      `UPDATE users SET password = $1, role = $2, portal = $3 WHERE id = $4`,
      [hashed, role, PORTALS.DEFAULT, userId],
    );
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (email, password, role, portal) VALUES ($1, $2, $3, $4) RETURNING id`,
      [email, hashed, role, PORTALS.DEFAULT],
    );
    userId = inserted.rows[0].id;
    created = true;
  }

  return { userId, email, role, created };
}

async function assignPublicLocations(userId) {
  const { rows } = await pool.query(
    `SELECT DISTINCT location
     FROM public.machines
     WHERE location IS NOT NULL AND BTRIM(location) <> ''
     ORDER BY location`,
  );
  const locations = rows.map((r) => r.location);
  if (locations.length === 0) {
    await pool.query(
      `INSERT INTO user_locations (user_id, location) VALUES ($1, $2)
       ON CONFLICT (user_id, location) DO NOTHING`,
      [userId, 'Plenma'],
    );
    return ['Plenma'];
  }
  for (const location of locations) {
    await pool.query(
      `INSERT INTO user_locations (user_id, location) VALUES ($1, $2)
       ON CONFLICT (user_id, location) DO NOTHING`,
      [userId, location],
    );
  }
  return locations;
}

async function main() {
  await migrateUserAccessSchema();
  for (const spec of USERS) {
    const result = await upsertUser(spec);
    const locations = await assignPublicLocations(result.userId);
    console.log(result.created ? `Created: ${result.email}` : `Updated: ${result.email}`);
    console.log(`  Role: ${result.role} | Portal: ${PORTALS.DEFAULT} | Login → /`);
    console.log(`  Password: ${spec.password}`);
    console.log(`  Locations: ${locations.join(', ')}`);
  }
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectRun) {
  main()
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      try {
        await pool.end();
      } catch {
        /* ignore */
      }
    });
}
