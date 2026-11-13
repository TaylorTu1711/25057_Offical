/**
 * Tạo user giám sát CNC nhà máy MIDA.
 * Được gọi từ `npm run build` / `npm run seed:mida-user` hoặc:
 *   cd backend && node scripts/create-mida-user.js
 *
 * Env:
 *   MIDA_USER_EMAIL (default: mida.cnc@plenma.com)
 *   MIDA_USER_PASSWORD (default: Mida@2026)
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

const email = process.env.MIDA_USER_EMAIL || 'mida.cnc@plenma.com';
const password = process.env.MIDA_USER_PASSWORD || 'Mida@2026';
const location = process.env.MIDA_LOCATION || 'MIDA';

async function main() {
  await migrateUserAccessSchema();
  const hashed = await bcrypt.hash(password, 10);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  let userId;

  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await pool.query(
      `UPDATE users SET password = $1, role = 'factory', portal = 'mida_cnc' WHERE id = $2`,
      [hashed, userId],
    );
    console.log(`Updated user: ${email}`);
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (email, password, role, portal) VALUES ($1, $2, 'factory', 'mida_cnc') RETURNING id`,
      [email, hashed],
    );
    userId = inserted.rows[0].id;
    console.log(`Created user: ${email}`);
  }

  await pool.query(
    `INSERT INTO user_locations (user_id, location) VALUES ($1, $2)
     ON CONFLICT (user_id, location) DO NOTHING`,
    [userId, location],
  );

  console.log(`Assigned location: ${location}`);
  console.log(`Login → /mida/cnc | Password: ${password}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
