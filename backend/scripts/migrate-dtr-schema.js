/**
 * Tạo schema dtr + bảng dtr.machines (giống cnc); xóa public.dtr_sort_machines nếu còn.
 *
 *   node backend/scripts/migrate-dtr-schema.js
 */
import pool from '../db.js';
import { DTR_MACHINES_TABLE, ensureDtrMachinesTable, SCHEMA } from '../utils/machineSchema.js';

async function main() {
  await ensureDtrMachinesTable(pool);

  const schemas = await pool.query(
    `SELECT schema_name FROM information_schema.schemata WHERE schema_name = $1`,
    [SCHEMA.DTR],
  );
  const count = await pool.query(`SELECT COUNT(*)::int AS n FROM ${DTR_MACHINES_TABLE}`);
  const sample = await pool.query(
    `SELECT machine_id, name, tailscale_ip, port, api_port
     FROM ${DTR_MACHINES_TABLE}
     ORDER BY machine_id
     LIMIT 10`,
  );

  console.log(`Schema "${SCHEMA.DTR}": ${schemas.rowCount ? 'OK' : 'MISSING'}`);
  console.log(`Table ${DTR_MACHINES_TABLE}: ${count.rows[0].n} machine(s)`);
  if (sample.rows.length) {
    console.table(sample.rows);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
