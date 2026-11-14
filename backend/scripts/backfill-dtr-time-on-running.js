/**
 * Backfill time_on / time_running cho telemetry DTR Sort.
 *
 * Ngày có counts (số chai > 0) nhưng time_on = time_running = 0:
 *   → gắn bộ đếm lũy kế tăng thêm 12 giờ (12*3600) trong ngày đó.
 * Ngày không có bản ghi / counts toàn 0: bỏ qua.
 *
 * KPI THỜI GIAN CHẠY LŨY KẾ đọc Σ delta theo ngày (getDtrUtilizationSummary),
 * nên mỗi ngày backfill đóng góp đúng 12h.
 *
 * Usage:
 *   node backend/scripts/backfill-dtr-time-on-running.js
 *   node backend/scripts/backfill-dtr-time-on-running.js <machine_id>
 *   node backend/scripts/backfill-dtr-time-on-running.js --dry-run
 */
import pool from '../db.js';
import { DTR_MACHINES_TABLE } from '../utils/machineSchema.js';
import {
  dtrTelemetryTableRef,
  ensureDtrTelemetryTable,
} from '../utils/dtrTelemetry.js';

const SECONDS_PER_FILL_DAY = 12 * 3600;

const args = process.argv.slice(2).filter(Boolean);
const dryRun = args.includes('--dry-run');
const onlyMachine = args.find((a) => a !== '--dry-run')?.trim() || '';

function dayKey(value) {
  if (value == null) return '';
  return String(value).slice(0, 10);
}

async function listMachines() {
  const { rows } = await pool.query(
    `SELECT machine_id, name FROM ${DTR_MACHINES_TABLE} ORDER BY machine_id`,
  );
  return rows.filter((r) => !onlyMachine || r.machine_id === onlyMachine);
}

async function findDaysNeedingBackfill(table) {
  const { rows } = await pool.query(
    `
    SELECT
      to_char(date_trunc('day', timestamp), 'YYYY-MM-DD') AS day,
      COUNT(*)::int AS row_count,
      COALESCE(MAX(time_on), 0)::bigint AS max_on,
      COALESCE(MAX(time_running), 0)::bigint AS max_run,
      BOOL_OR(
        EXISTS (
          SELECT 1
          FROM jsonb_each_text(COALESCE(counts, '{}'::jsonb)) kv
          WHERE kv.value ~ '^-?[0-9]+(\\.[0-9]+)?$'
            AND kv.value::numeric > 0
        )
      ) AS has_counts
    FROM ${table}
    WHERE timestamp IS NOT NULL
    GROUP BY 1
    ORDER BY 1
    `,
  );

  return rows.filter(
    (r) =>
      r.has_counts
      && Number(r.max_on) === 0
      && Number(r.max_run) === 0,
  );
}

async function maxTimeBeforeDay(table, day) {
  const { rows } = await pool.query(
    `
    SELECT
      COALESCE(MAX(time_on), 0)::bigint AS max_on,
      COALESCE(MAX(time_running), 0)::bigint AS max_run
    FROM ${table}
    WHERE timestamp IS NOT NULL
      AND timestamp < $1::timestamp
    `,
    [`${day} 00:00:00`],
  );
  const maxOn = Number(rows[0]?.max_on) || 0;
  const maxRun = Number(rows[0]?.max_run) || 0;
  return Math.max(maxOn, maxRun);
}

async function backfillMachine(machineId) {
  await ensureDtrTelemetryTable(pool, machineId);
  const table = dtrTelemetryTableRef(machineId);
  const days = await findDaysNeedingBackfill(table);

  console.log(
    `\n[${machineId}] days needing backfill: ${days.length}`
      + (dryRun ? ' (dry-run)' : ''),
  );

  if (!days.length) return { machineId, days: 0, rows: 0 };

  let updatedRows = 0;
  let cum = 0;

  for (const row of days) {
    const day = dayKey(row.day);
    const baseline = Math.max(cum, await maxTimeBeforeDay(table, day));
    const next = baseline + SECONDS_PER_FILL_DAY;

    const firstRes = await pool.query(
      `
      SELECT id
      FROM ${table}
      WHERE timestamp IS NOT NULL
        AND timestamp >= $1::timestamp
        AND timestamp < ($1::timestamp + INTERVAL '1 day')
      ORDER BY timestamp ASC, id ASC
      LIMIT 1
      `,
      [`${day} 00:00:00`],
    );
    const firstId = firstRes.rows[0]?.id ?? null;

    if (dryRun) {
      console.log(
        `  ${day}: rows=${row.row_count} → end=${next}s`
          + (firstId != null ? ` (first id=${firstId} → ${baseline}s)` : ''),
      );
      cum = next;
      updatedRows += Number(row.row_count) || 0;
      continue;
    }

    const updAll = await pool.query(
      `
      UPDATE ${table}
      SET time_on = $2,
          time_running = $2
      WHERE timestamp IS NOT NULL
        AND timestamp >= $1::timestamp
        AND timestamp < ($1::timestamp + INTERVAL '1 day')
        AND COALESCE(time_on, 0) = 0
        AND COALESCE(time_running, 0) = 0
      `,
      [`${day} 00:00:00`, next],
    );

    if (firstId != null && baseline !== next) {
      await pool.query(
        `
        UPDATE ${table}
        SET time_on = $2,
            time_running = $2
        WHERE id = $1
        `,
        [firstId, baseline],
      );
    }

    console.log(
      `  ${day}: updated=${updAll.rowCount} end=${next}s`
        + (firstId != null ? ` first=${baseline}s` : ''),
    );
    cum = next;
    updatedRows += updAll.rowCount || 0;
  }

  return { machineId, days: days.length, rows: updatedRows };
}

async function main() {
  const machines = await listMachines();
  if (!machines.length) {
    console.log(
      onlyMachine
        ? `Không tìm thấy máy DTR: ${onlyMachine}`
        : 'Không có máy trong dtr.machines',
    );
    return;
  }

  console.log(
    `Backfill DTR time_on/time_running = +${SECONDS_PER_FILL_DAY}s/ngày có chai`
      + (dryRun ? ' [DRY-RUN]' : ''),
  );
  console.table(machines);

  const results = [];
  for (const m of machines) {
    results.push(await backfillMachine(m.machine_id));
  }

  console.log('\nSummary');
  console.table(results);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
