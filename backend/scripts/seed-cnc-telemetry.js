/**
 * Tạo dữ liệu giả lập cho bảng telemetry máy CNC (schema `cnc`).
 *
 * Usage:
 *   node scripts/seed-cnc-telemetry.js                 # mặc định máy mida_cnc_1, 7 ngày
 *   node scripts/seed-cnc-telemetry.js mida_cnc_1 7    # <machine_id> <số ngày>
 *
 * - Sinh mẫu mỗi 5 phút, mô phỏng chu kỳ chạy/dừng.
 * - Ghi các thông số điện: điện áp/dòng 3 pha, công suất, điện năng tiêu thụ lũy kế.
 * - Tự tạo schema + bảng nếu chưa có (đúng cấu trúc máy CNC mới).
 */
import pool from '../db.js';
import { telemetryTableRef, ensureCncSchema } from '../utils/machineSchema.js';
import { ensureCncElectricalTelemetryColumns } from '../utils/cncTelemetry.js';

const machineId = (process.argv[2] || 'mida_cnc_1').trim();
const days = Math.max(1, Number(process.argv[3]) || 7);
const SAMPLE_INTERVAL_SEC = 5 * 60; // 5 phút

const table = telemetryTableRef(machineId, 'cnc');

const rand = (min, max) => min + Math.random() * (max - min);
const round = (val, digits = 2) => {
  const f = 10 ** digits;
  return Math.round(val * f) / f;
};

// Trạng thái: 2 = đang chạy, 1 = dừng (giữ đồng bộ với quy ước SCADA)
const STATUS_RUN = 2;
const STATUS_STOP = 1;

async function ensureTable() {
  await ensureCncSchema(pool);
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
}

function buildRows() {
  const rows = [];
  const now = new Date();
  const start = new Date(now.getTime() - days * 24 * 3600 * 1000);
  const totalSamples = Math.floor((days * 24 * 3600) / SAMPLE_INTERVAL_SEC);

  let nr = 0;
  let timeOn = 0; // giây máy được bật (lũy kế)
  let timeRunning = 0; // giây máy thực chạy (lũy kế)
  let powerConsumption = 0; // kWh lũy kế

  // Chu kỳ chạy/dừng: mỗi lần đổi trạng thái kéo dài ngẫu nhiên vài chục phút
  let running = true;
  let stateSamplesLeft = Math.round(rand(6, 30));

  for (let i = 0; i < totalSamples; i += 1) {
    const ts = new Date(start.getTime() + i * SAMPLE_INTERVAL_SEC * 1000);
    const hour = ts.getHours();

    // Ban đêm (22h-6h) tăng khả năng dừng
    const isNight = hour >= 22 || hour < 6;

    if (stateSamplesLeft <= 0) {
      running = isNight ? Math.random() < 0.25 : Math.random() < 0.8;
      stateSamplesLeft = Math.round(running ? rand(6, 36) : rand(3, 18));
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
      phase1V = rand(228, 236); // không tải, điện áp cao hơn chút
      phase2V = rand(228, 236);
      phase3V = rand(228, 236);
      phase1A = rand(0.1, 1.2);
      phase2A = rand(0.1, 1.2);
      phase3A = rand(0.1, 1.2);
    }

    const avgV = (phase1V + phase2V + phase3V) / 3;
    const avgA = (phase1A + phase2A + phase3A) / 3;

    // Công suất 3 pha ~ sqrt(3) * V_line * I * pf. Dùng điện áp pha, pf ~ 0.85
    const powerFactor = running ? rand(0.82, 0.92) : rand(0.4, 0.6);
    power = (Math.sqrt(3) * avgV * avgA * powerFactor) / 1000; // kW

    // Điện năng tiêu thụ cộng dồn theo khoảng thời gian mẫu
    powerConsumption += power * (SAMPLE_INTERVAL_SEC / 3600); // kWh
    const frequency = running ? rand(49.7, 50.3) : rand(49.5, 50.5);

    rows.push({
      nr,
      machine_id: machineId,
      timestamp: ts.toISOString(),
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
     SET status = $1, last_updated = $2
     WHERE machine_id = $3`,
    [lastRow.status, lastRow.timestamp, machineId],
  );
}

try {
  console.log(`Seeding ${days} ngày dữ liệu cho ${table} ...`);
  await ensureTable();

  await pool.query(`TRUNCATE ${table} RESTART IDENTITY`);

  const rows = buildRows();
  await insertRows(rows);
  await updateMachineRow(rows[rows.length - 1]);

  console.log(`✅ Đã tạo ${rows.length} bản ghi (mỗi 5 phút, ${days} ngày).`);
  console.log(`   Mẫu cuối: status=${rows[rows.length - 1].status}, power=${rows[rows.length - 1].power} kW, kWh=${rows[rows.length - 1].power_consumption}`);
} catch (err) {
  console.error('Seed thất bại:', err.message);
  process.exitCode = 1;
} finally {
  await pool.end();
}
