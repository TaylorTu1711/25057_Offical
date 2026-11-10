/**
 * Tạo user portal DTR Sort Machine.
 * cd backend && node scripts/create-dtr-sortmachine-user.js
 */
import bcrypt from 'bcrypt';
import pool from '../db.js';
import { migrateUserAccessSchema } from '../utils/dbMigrate.js';
import { PORTALS } from '../utils/userScope.js';

const email = process.env.DTR_USER_EMAIL || 'dtrsortmachine@plenma.com';
const password = process.env.DTR_USER_PASSWORD || 'dtrsortmachine@plenma.com';

async function main() {
  await migrateUserAccessSchema();
  const hashed = await bcrypt.hash(password, 10);

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  let userId;

  if (existing.rows[0]) {
    userId = existing.rows[0].id;
    await pool.query(
      `UPDATE users SET password = $1, role = 'factory', portal = $2 WHERE id = $3`,
      [hashed, PORTALS.DTR_SORTMACHINE, userId],
    );
    console.log(`Updated user: ${email}`);
  } else {
    const inserted = await pool.query(
      `INSERT INTO users (email, password, role, portal) VALUES ($1, $2, 'factory', $3) RETURNING id`,
      [email, hashed, PORTALS.DTR_SORTMACHINE],
    );
    userId = inserted.rows[0].id;
    console.log(`Created user: ${email}`);
  }

  console.log(`User id: ${userId}`);
  console.log(`Portal: ${PORTALS.DTR_SORTMACHINE}`);
  console.log(`Login → /dtr/sortmachine | Password: ${password}`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
