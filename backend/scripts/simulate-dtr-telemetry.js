/**
 * Giả lập telemetry DTR Sort (status / time_on / time_running / counts).
 *
 * Usage:
 *   node backend/scripts/simulate-dtr-telemetry.js
 *   node backend/scripts/simulate-dtr-telemetry.js 25231_100_70_140_122
 *   node backend/scripts/simulate-dtr-telemetry.js 25231_100_70_140_122 --hours 6
 *   node backend/scripts/simulate-dtr-telemetry.js 25231_100_70_140_122 --clear
 */
import pool from '../db.js';
import { DTR_MACHINES_TABLE } from '../utils/machineSchema.js';
import {
  DTR_COUNT_KEYS,
  dtrTelemetryTableRef,
  ensureDtrTelemetryTable,
} from '../utils/dtrTelemetry.js';

const DEFAULT_MACHINE = '25231_100_70_140_122';
const SAMPLE_INTERVAL_MS = 30_000;

const args = process.argv.slice(2).filter(Boolean);
const clear = args.includes('--clear');
const hoursIdx = args.indexOf('--hours');
const hours = hoursIdx >= 0
  ? Math.min(72, Math.max(1, Number(args[hoursIdx + 1]) || 6))
  : 6;
const machineId = args.find((a, i) => !a.startsWith('--') && (hoursIdx < 0 || i !== hoursIdx + 1))
  || DEFAULT_MACHINE;

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Timestamp local VN dạng 'YYYY-MM-DD HH:mm:ss.SSS' (TIMESTAMP WITHOUT TIME ZONE). */
function formatLocalTs(date) {
  return (
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
    + ` ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`
    + `.${String(date.getMilliseconds()).padStart(3, '0')}`
  );
}

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function emptyCounts() {
  const out = {};
  for (const key of DTR_COUNT_KEYS) out[key] = 0;
  out.ptp = 0;
  out.zz_cochai = 0;
  out.zz_nap = 0;
  return out;
}

function bumpCounts(counts, running) {
  if (!running) return;
  // Chủ yếu chai không nhãn + vài loại có nhãn
  counts.b1_kn += Math.floor(rand(8, 28));
  counts.b4_kn += Math.floor(rand(3, 14));
  counts.b5_kn += Math.floor(rand(2, 10));
  if (Math.random() < 0.55) counts.b1_nl += Math.floor(rand(1, 6));
  if (Math.random() < 0.35) counts.b1_nn += Math.floor(rand(0, 4));
  if (Math.random() < 0.25) counts.b1_oh += Math.floor(rand(0, 3));
  if (Math.random() < 0.4) counts.b4_nl += Math.floor(rand(0, 5));
  if (Math.random() < 0.2) counts.b4_nn += Math.floor(rand(0, 3));
  if (Math.random() < 0.3) counts.b5_nl += Math.floor(rand(0, 4));
  if (Math.random() < 0.15) counts.hu_kn += Math.floor(rand(0, 3));
  if (Math.random() < 0.1) counts.hu_nl += Math.floor(rand(0, 2));
  if (Math.random() < 0.08) counts.no_classify += Math.floor(rand(0, 2));
  if (Math.random() < 0.2) counts.zz_nap += Math.floor(rand(0, 4));
  if (Math.random() < 0.12) counts.zz_cochai += Math.floor(rand(0, 3));
}

async function main() {
  await ensureDtrTelemetryTable(pool, machineId);
  const table = dtrTelemetryTableRef(machineId);

  const machine = await pool.query(
    `SELECT machine_id, name FROM ${DTR_MACHINES_TABLE} WHERE machine_id = $1`,
    [machineId],
  );
  if (!machine.rowCount) {
    console.error(`Không tìm thấy máy trong dtr.machines: ${machineId}`);
    process.exitCode = 1;
    return;
  }
  console.log(`Máy: ${machine.rows[0].machine_id} (${machine.rows[0].name || '—'})`);
  console.log(`Giả lập ${hours}h gần nhất, mỗi mẫu ~${SAMPLE_INTERVAL_MS / 1000}s`);

  if (clear) {
    const del = await pool.query(`DELETE FROM ${table}`);
    console.log(`Đã xóa ${del.rowCount} dòng telemetry cũ`);
  }

  // Tiếp nối counts/time nếu còn dữ liệu
  const lastRes = await pool.query(
    `SELECT time_on, time_running, counts, status
     FROM ${table}
     ORDER BY timestamp DESC NULLS LAST, id DESC
     LIMIT 1`,
  );
  const last = lastRes.rows[0] || null;
  let timeOn = Number(last?.time_on) || 0;
  let timeRunning = Number(last?.time_running) || 0;
  let counts = {
    ...emptyCounts(),
    ...(last?.counts && typeof last.counts === 'object' ? last.counts : {}),
  };
  for (const key of Object.keys(counts)) {
    counts[key] = Number(counts[key]) || 0;
  }

  const now = new Date();
  const start = new Date(now.getTime() - hours * 3600_000);
  const rows = [];
  let status = 1;
  let nr = 1;
  let gapUntil = 0;

  for (let t = start.getTime(); t <= now.getTime(); t += SAMPLE_INTERVAL_MS) {
    // Thỉnh thoảng dừng 3–8 phút, hoặc mất dữ liệu 4–10 phút
    if (t >= gapUntil && Math.random() < 0.04) {
      const kind = Math.random();
      if (kind < 0.45) {
        status = 0;
        gapUntil = t + rand(3, 8) * 60_000;
      } else if (kind < 0.75) {
        status = 1;
        gapUntil = t + rand(2, 6) * 60_000;
      } else {
        // Mất telemetry: nhảy thời gian
        t += rand(4, 10) * 60_000;
        status = 1;
        gapUntil = t;
        continue;
      }
    }
    if (t >= gapUntil && status === 0 && Math.random() < 0.35) {
      status = 1;
    }

    const stepSec = SAMPLE_INTERVAL_MS / 1000;
    timeOn += stepSec;
    if (status === 1) {
      timeRunning += Math.floor(stepSec * rand(0.82, 0.98));
      bumpCounts(counts, true);
    }

    rows.push({
      nr: nr++,
      timestamp: formatLocalTs(new Date(t)),
      status,
      time_on: Math.floor(timeOn),
      time_running: Math.floor(timeRunning),
      counts: { ...counts },
    });
  }

  // Chèn theo batch
  const client = await pool.connect();
  let inserted = 0;
  try {
    await client.query('BEGIN');
    for (let i = 0; i < rows.length; i += 50) {
      const chunk = rows.slice(i, i + 50);
      const values = [];
      const params = [];
      let p = 1;
      for (const row of chunk) {
        values.push(
          `($${p++}, $${p++}, $${p++}::timestamp, $${p++}, $${p++}, $${p++}, $${p++}::jsonb)`,
        );
        params.push(
          row.nr,
          machineId,
          row.timestamp,
          row.status,
          row.time_on,
          row.time_running,
          JSON.stringify(row.counts),
        );
      }
      await client.query(
        `INSERT INTO ${table}
          (nr, machine_id, timestamp, status, time_on, time_running, counts)
         VALUES ${values.join(',')}`,
        params,
      );
      inserted += chunk.length;
    }

    const lastRow = rows[rows.length - 1];
    await client.query(
      `UPDATE ${DTR_MACHINES_TABLE}
       SET status = $2,
           last_updated = $3::timestamp,
           updated_at = NOW()
       WHERE machine_id = $1`,
      [machineId, lastRow?.status ?? 1, lastRow?.timestamp || formatLocalTs(now)],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  const totalBottles = Object.entries(counts).reduce((s, [k, v]) => {
    if (k === 'zz_cochai' || k === 'zz_nap') return s;
    return s + (Number(v) || 0);
  }, 0);

  console.log(`Đã chèn ${inserted} dòng`);
  console.log(`time_on=${Math.floor(timeOn)}s  time_running=${Math.floor(timeRunning)}s`);
  console.log(`counts (excl. zz_* total) ≈ ${totalBottles.toLocaleString('vi-VN')} chai`);
  console.log(`status cuối = ${rows[rows.length - 1]?.status}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end().catch(() => {});
  });
