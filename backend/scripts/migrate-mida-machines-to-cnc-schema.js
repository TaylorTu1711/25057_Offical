/**
 * Chuyển máy CNC / ép từ public.machines → cnc.machines (chạy một lần).
 * Usage: node scripts/migrate-mida-machines-to-cnc-schema.js
 */
import pool from '../db.js';
import { CNC_MACHINES_TABLE, ensureCncMachinesTable, PUBLIC_MACHINES_TABLE } from '../utils/machineSchema.js';

const MIDA_MACHINE_FILTER = `
  machine_category IN ('cnc', 'ep')
  OR machine_name ILIKE '%CNC%'
  OR machine_id ILIKE '%cnc%'
  OR machine_name ILIKE '%ép%'
  OR machine_name ILIKE '%EP%'
  OR machine_id ILIKE '%_ep_%'
  OR machine_id ILIKE '%ep%'
`;

await ensureCncMachinesTable(pool);

const { rows: toMove } = await pool.query(`
  SELECT * FROM ${PUBLIC_MACHINES_TABLE}
  WHERE ${MIDA_MACHINE_FILTER}
  ORDER BY machine_id
`);

if (toMove.length === 0) {
  console.log('Không có máy CNC/ép nào trong public.machines cần chuyển.');
  await pool.end();
  process.exit(0);
}

const client = await pool.connect();
let moved = 0;
let skipped = 0;

try {
  await client.query('BEGIN');

  for (const machine of toMove) {
    const exists = await client.query(
      `SELECT 1 FROM ${CNC_MACHINES_TABLE} WHERE machine_id = $1`,
      [machine.machine_id],
    );
    if (exists.rowCount > 0) {
      skipped += 1;
      continue;
    }

    const cols = Object.keys(machine);
    const vals = Object.values(machine);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
    await client.query(
      `INSERT INTO ${CNC_MACHINES_TABLE} (${cols.join(', ')}) VALUES (${placeholders})`,
      vals,
    );
    moved += 1;
  }

  await client.query(
    `DELETE FROM ${PUBLIC_MACHINES_TABLE} WHERE machine_id = ANY($1)`,
    [toMove.map((m) => m.machine_id)],
  );

  await client.query('COMMIT');
  console.log(`✅ Đã chuyển ${moved} máy sang cnc.machines (${skipped} đã tồn tại, bỏ qua).`);
  console.log(`   Còn lại trong public.machines: máy Plenma/standard.`);
} catch (err) {
  await client.query('ROLLBACK').catch(() => {});
  console.error('Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
