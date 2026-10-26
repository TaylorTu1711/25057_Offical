/**
 * Tạo / cập nhật tài khoản maintenance CNC MIDA.
 * Chỉ xem trang tổng máy CNC và nhập thời gian setup theo ngày.
 *
 *   node backend/scripts/create-mida-maintenance.js
 *
 * Env:
 *   MIDA_MAINT_EMAIL (default: maintenance.cnc@plenma.com)
 *   MIDA_MAINT_PASSWORD (default: Mida@2026)
 *   MIDA_LOCATION (default: MIDA)
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { migrateUserAccessSchema } from '../utils/dbMigrate.js';
import { ROLES } from '../utils/cncDailySetup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const email = process.env.MIDA_MAINT_EMAIL || 'maintenance.cnc@plenma.com';
const password = process.env.MIDA_MAINT_PASSWORD || 'Mida@2026';
const location = process.env.MIDA_LOCATION || 'MIDA';

async function main() {
  await migrateUserAccessSchema();
  const hashed = await bcrypt.hash(password, 10);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  let userId;
  let created = false;

  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await pool.query(
      `UPDATE users SET password = $1, role = $2, portal = 'mida_cnc' WHERE id = $3`,
      [hashed, ROLES.MAINTENANCE, userId],
    );
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (email, password, role, portal) VALUES ($1, $2, $3, 'mida_cnc') RETURNING id`,
      [email, hashed, ROLES.MAINTENANCE],
    );
    userId = inserted.rows[0].id;
    created = true;
  }

  await pool.query(
    `INSERT INTO user_locations (user_id, location) VALUES ($1, $2)
     ON CONFLICT (user_id, location) DO NOTHING`,
    [userId, location],
  );

  console.log(created ? `Created maintenance: ${email}` : `Updated maintenance: ${email}`);
  console.log(`Role: ${ROLES.MAINTENANCE} | Portal: mida_cnc | Location: ${location}`);
  console.log(`Login → /mida/cnc`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
