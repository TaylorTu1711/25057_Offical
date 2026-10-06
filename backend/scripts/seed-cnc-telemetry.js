/**
 * Tạo dữ liệu giả lập cho bảng telemetry máy CNC (schema `cnc`).
 *
 * Usage:
 *   node scripts/seed-cnc-telemetry.js                 # mặc định máy mida_cnc_1, 2 ngày
 *   node scripts/seed-cnc-telemetry.js mida_cnc_1 2    # <machine_id> <số ngày>
 *
 * - Sinh mẫu mỗi 30 giây, mô phỏng chu kỳ chạy/dừng + vài khoảng chưa kết nối.
 * - Ghi các thông số điện: điện áp/dòng 3 pha, công suất, điện năng tiêu thụ lũy kế.
 * - Tự tạo schema + bảng + dòng máy trong cnc.machines nếu chưa có.
 */
import pool from '../db.js';
import {
  telemetryTableRef,
  ensureCncSchema,
  ensureCncMachinesTable,
} from '../utils/machineSchema.js';
import { ensureCncElectricalTelemetryColumns } from '../utils/cncTelemetry.js';

const machineId = (process.argv[2] || 'mida_cnc_1').trim();
const days = Math.max(1, Number(process.argv[3]) || 2);
const SAMPLE_INTERVAL_SEC = 30;

const table = telemetryTableRef(machineId, 'cnc');

const rand = (min, max) => min + Math.random() * (max - min);
const round = (val, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(val * f) / f;
};

const STATUS_RUN = 2;
const STATUS_STOP = 1;
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
/** Cột timestamp là giờ tường VN. toISOString() là UTC nên phải +7 trước khi ghi. */
const TAIL_RUN_MS = 60 * 60 * 1000;

function toVietnamWallClock(date) {
  const shifted = new Date(date.getTime() + VIETNAM_OFFSET_MS);
  return shifted.toISOString().slice(0, 23).replace('T', ' ');
}

async function ensureTable() {
  await ensureCncSchema(pool);
  await ensureCncMachinesTable(pool);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id SERIAL PRIMARY KEY,
      nr INTEGER,
      machine_id VARCHAR(255),
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      time_on INTEGER,
      time_running INTEGER,
      phase1_v REAL,
      phase2_v REAL,
      phase3_v REAL,
      avg_v REAL,
      phase1_a REAL,
      phase2_a REAL,
      phase3_a REAL,
      avg_a REAL,
      power REAL,
      power_consumption REAL,
      frequency REAL,
      status INTEGER
    );
  `);
  await ensureCncElectricalTelemetryColumns(pool, table);

  await pool.query(
    `INSERT INTO cnc.machines (machine_id, machine_name, location, machine_category, status, last_updated)
     VALUES ($1, $2, $3, 'cnc', 1, NOW())
     ON CONFLICT (machine_id) DO NOTHING`,
    [machineId, machineId.toUpperCase().replace(/_/g, ' '), 'MIDA'],
  );
}

function buildRows() {
  const rows = [];
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 3600 * 1000);
  const endMs = now.getTime();

  let nr = 0;
  let timeOn = 0;
  let timeRunning = 0;
  let powerConsumption = 0;

  let running = true;
  let stateSamplesLeft = Math.round(rand(20, 80));
  let offlineSamplesLeft = 0;
  let nextOfflineIn = Math.round(rand(80, 200));

  for (let t = start.getTime(); t <= endMs; t += SAMPLE_INTERVAL_SEC * 1000) {
    const inTail = endMs - t <= TAIL_RUN_MS;
    // 60 phút cuối luôn có mẫu và đang chạy, để mép phải Gantt không bị vàng.
    if (inTail) {
      offlineSamplesLeft = 0;
      running = true;
      stateSamplesLeft = 10_000;
    }

    // Khoảng chưa kết nối: bỏ mẫu (Gantt sẽ tô vàng)
    if (!inTail && offlineSamplesLeft > 0) {
      offlineSamplesLeft -= 1;
      continue;
    }

    if (!inTail) {
      nextOfflineIn -= 1;
      if (nextOfflineIn <= 0) {
        offlineSamplesLeft = Math.round(rand(10, 40)); // ~5–20 phút mất mẫu
        nextOfflineIn = Math.round(rand(120, 360));
        continue;
      }
    }

    const ts = new Date(t);
    const hour = ts.getHours();
    const isNight = hour >= 22 || hour < 6;

    if (!inTail && stateSamplesLeft <= 0) {
      running = isNight ? Math.random() < 0.25 : Math.random() < 0.75;
      stateSamplesLeft = Math.round(running ? rand(40, 120) : rand(20, 60));
    }
    stateSamplesLeft -= 1;

    nr += 1;
    timeOn += SAMPLE_INTERVAL_SEC;

    let phase1V;
    let phase2V;
    let phase3V;
    let phase1A;
    let phase2A;
    let phase3A;
    let power;
    let status;

    if (running) {
      timeRunning += SAMPLE_INTERVAL_SEC;
      status = STATUS_RUN;
      phase1V = rand(218, 232);
      phase2V = rand(218, 232);
      phase3V = rand(218, 232);
      phase1A = rand(8, 26);
      phase2A = rand(8, 26);
      phase3A = rand(8, 26);
    } else {
      status = STATUS_STOP;
      phase1V = rand(228, 236);
      phase2V = rand(228, 236);
      phase3V = rand(228, 236);
      phase1A = rand(0.1, 1.2);
      phase2A = rand(0.1, 1.2);
      phase3A = rand(0.1, 1.2);
    }

    const avgV = (phase1V + phase2V + phase3V) / 3;
    const avgA = (phase1A + phase2A + phase3A) / 3;
    const powerFactor = running ? rand(0.82, 0.92) : rand(0.4, 0.6);
    power = (Math.sqrt(3) * avgV * avgA * powerFactor) / 1000;
    powerConsumption += power * (SAMPLE_INTERVAL_SEC / 3600);
    const frequency = running ? rand(49.7, 50.3) : rand(49.5, 50.5);

    rows.push({
      nr,
      machine_id: machineId,
      timestamp: toVietnamWallClock(ts),
      time_on: timeOn,
      time_running: timeRunning,
      phase1_v: round(phase1V),
      phase2_v: round(phase2V),
      phase3_v: round(phase3V),
      avg_v: round(avgV),
      phase1_a: round(phase1A),
      phase2_a: round(phase2A),
      phase3_a: round(phase3A),
      avg_a: round(avgA),
      power: round(power),
      power_consumption: round(powerConsumption, 3),
      frequency: round(frequency, 2),
      status,
    });
  }

  return rows;
}

async function insertRows(rows) {
  const cols = [
    'nr', 'machine_id', 'timestamp', 'time_on', 'time_running',
    'phase1_v', 'phase2_v', 'phase3_v', 'avg_v',
    'phase1_a', 'phase2_a', 'phase3_a', 'avg_a',
    'power', 'power_consumption', 'frequency', 'status',
  ];

  const BATCH = 500;
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    const values = [];
    const params = [];
    chunk.forEach((row, idx) => {
      const base = idx * cols.length;
      values.push(`(${cols.map((_, c) => `$${base + c + 1}`).join(', ')})`);
      params.push(...cols.map((c) => row[c]));
    });
    await pool.query(
      `INSERT INTO ${table} (${cols.join(', ')}) VALUES ${values.join(', ')}`,
      params,
    );
  }
}

async function updateMachineRow(lastRow) {
  await pool.query(
    `UPDATE cnc.machines
     SET status = $1,
         last_updated = $2,
         machine_name = COALESCE(NULLIF(machine_name, ''), $3),
         machine_category = 'cnc'
     WHERE machine_id = $4`,
    [lastRow.status, lastRow.timestamp, machineId.toUpperCase().replace(/_/g, ' '), machineId],
  );
}

try {
  console.log(`Seeding ${days} ngày dữ liệu cho ${table} (mỗi ${SAMPLE_INTERVAL_SEC}s) ...`);
  await ensureTable();

  await pool.query(`TRUNCATE ${table} RESTART IDENTITY`);

  const rows = buildRows();
  await insertRows(rows);
  await updateMachineRow(rows[rows.length - 1]);

  const last = rows[rows.length - 1];
  console.log(`✅ Đã tạo ${rows.length} bản ghi cho ${machineId}.`);
  console.log(`   Mẫu cuối: status=${last.status}, power=${last.power} kW, kWh=${last.power_consumption}, ts=${last.timestamp}`);
} catch (err) {
  console.error('Seed thất bại:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
