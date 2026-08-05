/**
 * Tạo / cập nhật tài khoản admin cho portal CNC MIDA.
 * Được gọi từ `npm run build` (root) hoặc:
 *   cd backend && node scripts/create-mida-admin.js
 *
 * Env:
 *   MIDA_ADMIN_EMAIL (default: admincnc@plenma.com)
 *   MIDA_ADMIN_PASSWORD (default: admincnc@plenma.com)
 *   MIDA_LOCATION (default: MIDA)
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { migrateUserAccessSchema } from '../utils/dbMigrate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const email = process.env.MIDA_ADMIN_EMAIL || 'admincnc@plenma.com';
const password = process.env.MIDA_ADMIN_PASSWORD || 'admincnc@plenma.com';
const location = process.env.MIDA_LOCATION || 'MIDA';

export async function ensureMidaCncAdmin({
  adminEmail = email,
  adminPassword = password,
  adminLocation = location,
} = {}) {
  await migrateUserAccessSchema();
  const hashed = await bcrypt.hash(adminPassword, 10);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  let userId;
  let created = false;

  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await pool.query(
      `UPDATE users SET password = $1, role = 'admin', portal = 'mida_cnc' WHERE id = $2`,
      [hashed, userId],
    );
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (email, password, role, portal) VALUES ($1, $2, 'admin', 'mida_cnc') RETURNING id`,
      [adminEmail, hashed],
    );
    userId = inserted.rows[0].id;
    created = true;
  }

  await pool.query(
    `INSERT INTO user_locations (user_id, location) VALUES ($1, $2)
     ON CONFLICT (user_id, location) DO NOTHING`,
    [userId, adminLocation],
  );

  return { userId, email: adminEmail, created, location: adminLocation };
}

async function main() {
  const result = await ensureMidaCncAdmin();
  console.log(result.created ? `Created admin: ${result.email}` : `Updated admin: ${result.email}`);
  console.log(`Role: admin | Portal: mida_cnc | Location: ${result.location}`);
  console.log(`Login → /mida/cnc`);
  console.log(`Email: ${result.email}`);
  console.log(`Password: ${password}`);
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
