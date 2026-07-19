/**
 * Di chuyển bảng CNC từ schema public → cnc (chạy một lần nếu đã tạo máy CNC trước đó).
 * Usage: node scripts/migrate-cnc-tables-to-schema.js
 */
import pool from '../db.js';
import { ensureCncSchema } from '../utils/machineSchema.js';

const { rows: machines } = await pool.query(`
  SELECT machine_id FROM machines
  WHERE machine_category = 'cnc'
     OR machine_name ILIKE '%CNC%'
     OR machine_id ILIKE '%cnc%'
`);

await ensureCncSchema(pool);

let moved = 0;
for (const { machine_id } of machines) {
  const alarmName = `alarm${machine_id}`;
  for (const tableName of [machine_id, alarmName]) {
    const inPublic = await pool.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = $1`,
      [tableName],
    );
    if (inPublic.rowCount === 0) continue;

    await pool.query(`ALTER TABLE public."${tableName}" SET SCHEMA cnc`);
    console.log(`  ✓ public."${tableName}" → cnc."${tableName}"`);
    moved += 1;
  }
}

console.log(`\nDone. Moved ${moved} table(s) for ${machines.length} CNC machine(s).`);
await pool.end();
