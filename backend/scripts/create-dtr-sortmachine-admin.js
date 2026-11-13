/**
 * Tạo / cập nhật admin portal DTR Sort Machine (thêm / sửa / xóa máy).
 * cd backend && node scripts/create-dtr-sortmachine-admin.js
 *
 * Env:
 *   DTR_ADMIN_EMAIL (default: admin.sortdtr@plenma.com)
 *   DTR_ADMIN_PASSWORD (default: admin.sortdtr@plenma.com)
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

const email = process.env.DTR_ADMIN_EMAIL || 'admin.sortdtr@plenma.com';
const password = process.env.DTR_ADMIN_PASSWORD || 'admin.sortdtr@plenma.com';

export async function ensureDtrSortAdmin({
  adminEmail = email,
  adminPassword = password,
} = {}) {
  await migrateUserAccessSchema();
  const hashed = await bcrypt.hash(adminPassword, 10);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
  let userId;
  let created = false;

  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await pool.query(
      `UPDATE users SET password = $1, role = 'admin', portal = $2 WHERE id = $3`,
      [hashed, PORTALS.DTR_SORTMACHINE, userId],
    );
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (email, password, role, portal) VALUES ($1, $2, 'admin', $3) RETURNING id`,
      [adminEmail, hashed, PORTALS.DTR_SORTMACHINE],
    );
    userId = inserted.rows[0].id;
    created = true;
  }

  return { userId, email: adminEmail, created };
}

async function main() {
  const result = await ensureDtrSortAdmin();
  console.log(result.created ? `Created admin: ${result.email}` : `Updated admin: ${result.email}`);
  console.log(`Role: admin | Portal: ${PORTALS.DTR_SORTMACHINE}`);
  console.log(`Login → /dtr/sortmachine`);
  console.log(`Email: ${result.email}`);
  console.log(`Password: ${password}`);
  console.log('Quyền: thêm / sửa / xóa máy Sort DTR');
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
