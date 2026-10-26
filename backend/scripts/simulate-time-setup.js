/**
 * Giả lập time_setup lũy kế trên bảng telemetry CNC hiện có.
 *
 * Usage:
 *   node backend/scripts/simulate-time-setup.js
 *   node backend/scripts/simulate-time-setup.js mida_cnc_1
 *
 * Setup = ~25–40% thời gian idle (time_on − time_running), tăng dần theo từng dòng.
 */
import pool from '../db.js';
import { ensureAllCncTelemetryColumns } from '../utils/cncTelemetry.js';

const onlyMachine = (process.argv[2] || '').trim();

/** Tỷ lệ idle được tính là setup — lệch nhẹ từng máy để pie khác nhau. */
const RATIO_BY_MACHINE = {
  mida_cnc_1: 0.34,
  mida_cnc_2: 0.26,
  mida_cnc_3: 0.41,
};
const DEFAULT_RATIO = 0.32;

async function listTelemetryTables() {
  const { rows } = await pool.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'cnc'
      AND table_type = 'BASE TABLE'
      AND table_name <> 'machines'
      AND table_name NOT LIKE 'alarm%'
    ORDER BY table_name
  `);
  return rows
    .map((r) => r.table_name)
    .filter((name) => !onlyMachine || name === onlyMachine);
}

async function simulateTable(tableName) {
  const qualified = `"cnc"."${tableName}"`;
  const ratio = RATIO_BY_MACHINE[tableName] ?? DEFAULT_RATIO;

  const result = await pool.query(
    `UPDATE ${qualified}
     SET time_setup = GREATEST(
       0,
       FLOOR(
         GREATEST(0, COALESCE(time_on, 0) - COALESCE(time_running, 0)) * $1::float8
       )::int
     )`,
    [ratio],
  );

  const { rows } = await pool.query(
    `SELECT COALESCE(time_on, 0) AS time_on,
            COALESCE(time_running, 0) AS time_running,
            COALESCE(time_setup, 0) AS time_setup
     FROM ${qualified}
     ORDER BY timestamp DESC NULLS LAST, id DESC
     LIMIT 1`,
  );
  const latest = rows[0] || { time_on: 0, time_running: 0, time_setup: 0 };
  const on = Number(latest.time_on) || 0;
  const runPct = on > 0 ? ((Number(latest.time_running) / on) * 100).toFixed(2) : '0.00';
  const setupPct = on > 0 ? ((Number(latest.time_setup) / on) * 100).toFixed(2) : '0.00';
  const stopPct = on > 0
    ? (100 - Number(runPct) - Number(setupPct)).toFixed(2)
    : '0.00';

  return {
    tableName,
    updated: result.rowCount,
    ratio,
    latest,
    pie: { runPct, setupPct, stopPct },
  };
}

async function main() {
  await ensureAllCncTelemetryColumns(pool);
  const tables = await listTelemetryTables();
  if (tables.length === 0) {
    console.log(onlyMachine ? `Không thấy bảng ${onlyMachine}` : 'Không có bảng telemetry CNC');
    return;
  }

  for (const name of tables) {
    const info = await simulateTable(name);
    console.log(
      `${info.tableName}: updated ${info.updated} rows, idle→setup ${(info.ratio * 100).toFixed(0)}%`,
    );
    console.log(
      `  latest  on=${info.latest.time_on}s  run=${info.latest.time_running}s  setup=${info.latest.time_setup}s`,
    );
    console.log(
      `  pie     cắt gọt ${info.pie.runPct}%  setup ${info.pie.setupPct}%  ngưng ${info.pie.stopPct}%`,
    );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await pool.end();
  });
