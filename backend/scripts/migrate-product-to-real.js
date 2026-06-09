/**
 * Migrate cột product: INTEGER -> REAL cho tất cả bảng máy hiện có.
 *
 * Chạy từ thư mục gốc project:
 *   npm run migrate:product-real
 */
import { loadEnv } from '../utils/loadEnv.js';

loadEnv();

let pool;
try {
  ({ default: pool } = await import('../db.js'));
} catch (err) {
  if (err?.code === 'ERR_MODULE_NOT_FOUND') {
    console.error('Thiếu package Node (vd. pg). Chạy một trong hai cách sau:\n');
    console.error('  1) npm install && npm run migrate:product-real');
    console.error('  2) psql -U postgres -d postgres -f backend/scripts/migrate-product-to-real.sql\n');
  }
  throw err;
}

const REAL_TYPES = new Set(['real', 'double precision', 'numeric']);

async function getColumnType(machineId, columnName) {
  const { rows } = await pool.query(
    `SELECT data_type
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = $1
       AND column_name = $2`,
    [machineId, columnName],
  );
  return rows[0]?.data_type ?? null;
}

async function tableExists(machineId) {
  const { rows } = await pool.query(
    `SELECT 1
     FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_name = $1`,
    [machineId],
  );
  return rows.length > 0;
}

async function migrateMachineTable(machineId) {
  const exists = await tableExists(machineId);
  if (!exists) {
    console.log(`[skip] ${machineId}: không có bảng dữ liệu`);
    return 'missing_table';
  }

  const dataType = await getColumnType(machineId, 'product');
  if (!dataType) {
    console.log(`[skip] ${machineId}: không có cột product`);
    return 'missing_column';
  }

  if (REAL_TYPES.has(dataType)) {
    console.log(`[ok]   ${machineId}: product đã là ${dataType}`);
    return 'already_real';
  }

  await pool.query(
    `ALTER TABLE "${machineId}" ALTER COLUMN product TYPE REAL USING product::real`,
  );
  console.log(`[done] ${machineId}: product ${dataType} -> REAL`);
  return 'migrated';
}

async function main() {
  const { rows: machines } = await pool.query(
    'SELECT machine_id FROM machines ORDER BY machine_id',
  );

  if (!machines.length) {
    console.log('Không có máy nào trong bảng machines.');
    return;
  }

  const summary = {
    migrated: 0,
    already_real: 0,
    missing_table: 0,
    missing_column: 0,
    failed: 0,
  };

  for (const { machine_id: machineId } of machines) {
    try {
      const result = await migrateMachineTable(machineId);
      summary[result] += 1;
    } catch (err) {
      summary.failed += 1;
      console.error(`[fail] ${machineId}:`, err.message);
    }
  }

  console.log('\n--- Kết quả migrate product -> REAL ---');
  console.log(summary);
}

main()
  .catch((err) => {
    console.error('Migrate thất bại:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
