import pool from '../db.js';
import { qualifyTable, SCHEMA } from './machineSchema.js';
import { vietnamDateKey } from './cncDailySetup.js';

export const SETUP_REASON = 'setup_may';

export const DOWNTIME_REASONS = [
  { code: 'thieu_nhan_su', label: 'Thiếu nhân sự' },
  { code: 'khong_ke_hoach', label: 'Không kế hoạch' },
  { code: SETUP_REASON, label: 'Setup máy' },
  { code: 'nghi_le_chu_nhat', label: 'Nghỉ lễ / chủ nhật' },
  { code: 'bao_tri_may', label: 'Bảo trì máy' },
  { code: 'giao_ca', label: 'Giao ca' },
  { code: 'thieu_vat_tu', label: 'Thiếu vật tư' },
  { code: 'khac', label: 'Nguyên nhân khác' },
];

const REASON_CODES = new Set(DOWNTIME_REASONS.map((r) => r.code));

export function safeMachineId(machineId) {
  const id = String(machineId || '').trim();
  if (!/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error('machine_id không hợp lệ');
  }
  return id;
}

export function downtimeTableRef(machineId) {
  return qualifyTable(SCHEMA.CNC, `${safeMachineId(machineId)}_downtime`);
}

export async function ensureDowntimeTable(db = pool, machineId) {
  const table = downtimeTableRef(machineId);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id SERIAL PRIMARY KEY,
      machine_id VARCHAR(255) NOT NULL,
      downtime_date DATE NOT NULL,
      start_at TIMESTAMP NOT NULL,
      end_at TIMESTAMP NOT NULL,
      duration_seconds INTEGER NOT NULL,
      reason_code VARCHAR(64) NOT NULL,
      reason_note TEXT,
      created_by INT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);
  const indexName = `"${safeMachineId(machineId)}_downtime_date_idx"`;
  await db.query(
    `CREATE INDEX IF NOT EXISTS ${indexName} ON ${table} (downtime_date, start_at)`,
  );
  return table;
}

export async function ensureAllCncDowntimeTables(db = pool) {
  const { rows } = await db.query(
    `SELECT machine_id FROM ${qualifyTable(SCHEMA.CNC, 'machines')}
     WHERE machine_id IS NOT NULL`,
  );
  for (const row of rows) {
    try {
      await ensureDowntimeTable(db, row.machine_id);
    } catch (err) {
      console.error(`ensureDowntimeTable ${row.machine_id}:`, err.message);
    }
  }
}

export async function dropDowntimeTable(db = pool, machineId) {
  await db.query(`DROP TABLE IF EXISTS ${downtimeTableRef(machineId)}`);
}

function normalizeTime(value) {
  const raw = String(value || '').trim();
  if (/^\d{2}:\d{2}$/.test(raw)) return `${raw}:00`;
  if (/^\d{2}:\d{2}:\d{2}$/.test(raw)) return raw;
  return '';
}

function nextDateKey(dateKey) {
  const d = new Date(`${dateKey}T00:00:00+07:00`);
  d.setUTCDate(d.getUTCDate() + 1);
  return vietnamDateKey(d);
}

function wallMs(dateTime) {
  return new Date(String(dateTime).replace(' ', 'T') + '+07:00').getTime();
}

function mapRow(row) {
  const start = String(row.start_at || '');
  const end = String(row.end_at || '');
  return {
    id: row.id,
    machine_id: row.machine_id,
    downtime_date: String(row.downtime_date).slice(0, 10),
    start_at: start,
    end_at: end,
    start_time: start.slice(11, 16),
    end_time: end.slice(11, 16),
    duration_seconds: Number(row.duration_seconds) || 0,
    reason_code: row.reason_code,
    reason_label: DOWNTIME_REASONS.find((r) => r.code === row.reason_code)?.label || row.reason_code,
    reason_note: row.reason_note || '',
    created_by: row.created_by,
    created_at: row.created_at,
  };
}

export async function listDowntimeForDate(db, machineId, dateKey) {
  const table = await ensureDowntimeTable(db, machineId);
  const { rows } = await db.query(
    `SELECT id, machine_id, downtime_date::text AS downtime_date,
            start_at::text AS start_at, end_at::text AS end_at,
            duration_seconds, reason_code, reason_note, created_by, created_at
     FROM ${table}
     WHERE downtime_date = $1::date
     ORDER BY start_at ASC, id ASC`,
    [dateKey],
  );
  return rows.map(mapRow);
}

export async function insertDowntime(db, {
  machineId,
  dateKey,
  startTime,
  endTime,
  reasonCode,
  reasonNote,
  userId,
}) {
  if (!REASON_CODES.has(reasonCode)) {
    throw Object.assign(new Error('Nguyên nhân không hợp lệ'), { status: 400 });
  }
  const startClock = normalizeTime(startTime);
  const endClock = normalizeTime(endTime);
  if (!startClock || !endClock) {
    throw Object.assign(new Error('Giờ bắt đầu / kết thúc không hợp lệ'), { status: 400 });
  }

  let endDate = dateKey;
  if (endClock <= startClock) endDate = nextDateKey(dateKey);
  const startAt = `${dateKey} ${startClock}`;
  const endAt = `${endDate} ${endClock}`;
  const duration = Math.round((wallMs(endAt) - wallMs(startAt)) / 1000);
  if (!Number.isFinite(duration) || duration <= 0) {
    throw Object.assign(new Error('Thời gian kết thúc phải sau thời gian bắt đầu'), { status: 400 });
  }
  if (duration > 86400) {
    throw Object.assign(new Error('Một khoảng dừng không quá 24 giờ'), { status: 400 });
  }

  const note = reasonCode === 'khac' ? String(reasonNote || '').trim() : '';
  if (reasonCode === 'khac' && !note) {
    throw Object.assign(new Error('Nhập mô tả cho nguyên nhân khác'), { status: 400 });
  }

  const table = await ensureDowntimeTable(db, machineId);
  const { rows } = await db.query(
    `INSERT INTO ${table} (
       machine_id, downtime_date, start_at, end_at, duration_seconds,
       reason_code, reason_note, created_by, created_at
     ) VALUES ($1, $2::date, $3::timestamp, $4::timestamp, $5, $6, $7, $8, CURRENT_TIMESTAMP)
     RETURNING id, machine_id, downtime_date::text AS downtime_date,
               start_at::text AS start_at, end_at::text AS end_at,
               duration_seconds, reason_code, reason_note, created_by, created_at`,
    [safeMachineId(machineId), dateKey, startAt, endAt, duration, reasonCode, note || null, userId || null],
  );
  return mapRow(rows[0]);
}

export async function deleteDowntime(db, machineId, eventId) {
  const table = await ensureDowntimeTable(db, machineId);
  const { rowCount } = await db.query(
    `DELETE FROM ${table} WHERE id = $1`,
    [eventId],
  );
  return rowCount > 0;
}

export async function sumSetupSecondsForDate(db, machineId, dateKey) {
  const table = await ensureDowntimeTable(db, machineId);
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(duration_seconds), 0)::int AS total
     FROM ${table}
     WHERE downtime_date = $1::date AND reason_code = $2`,
    [dateKey, SETUP_REASON],
  );
  return Number(rows[0]?.total) || 0;
}

export async function sumSetupSecondsAll(db, machineId) {
  const table = await ensureDowntimeTable(db, machineId);
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(duration_seconds), 0)::int AS total
     FROM ${table}
     WHERE reason_code = $1`,
    [SETUP_REASON],
  );
  return Number(rows[0]?.total) || 0;
}

export async function fetchDowntimePareto(db, machineId, fromDate, toDate) {
  const table = await ensureDowntimeTable(db, machineId);
  const params = [];
  const where = [];
  if (fromDate) {
    params.push(fromDate);
    where.push(`downtime_date >= $${params.length}::date`);
  }
  if (toDate) {
    params.push(toDate);
    where.push(`downtime_date <= $${params.length}::date`);
  }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await db.query(
    `SELECT reason_code,
            COALESCE(SUM(duration_seconds), 0)::int AS duration_seconds,
            COUNT(*)::int AS event_count
     FROM ${table}
     ${whereSql}
     GROUP BY reason_code`,
    params,
  );
  const byCode = new Map(rows.map((r) => [r.reason_code, r]));
  return DOWNTIME_REASONS.map((reason) => {
    const row = byCode.get(reason.code);
    const durationSeconds = Number(row?.duration_seconds) || 0;
    return {
      reason_code: reason.code,
      reason_label: reason.label,
      duration_seconds: durationSeconds,
      event_count: Number(row?.event_count) || 0,
      hours: Number((durationSeconds / 3600).toFixed(2)),
    };
  })
    .filter((item) => item.duration_seconds > 0)
    .sort((a, b) => b.duration_seconds - a.duration_seconds);
}

export async function fetchSetupSecondsByDate(db, machineId, fromDate, toDate) {
  const table = await ensureDowntimeTable(db, machineId);
  const params = [SETUP_REASON];
  const where = ['reason_code = $1'];
  if (fromDate) {
    params.push(fromDate);
    where.push(`downtime_date >= $${params.length}::date`);
  }
  if (toDate) {
    params.push(toDate);
    where.push(`downtime_date <= $${params.length}::date`);
  }
  const { rows } = await db.query(
    `SELECT downtime_date::text AS downtime_date, COALESCE(SUM(duration_seconds), 0)::int AS setup_seconds
     FROM ${table}
     WHERE ${where.join(' AND ')}
     GROUP BY downtime_date
     ORDER BY downtime_date ASC`,
    params,
  );
  const map = new Map();
  rows.forEach((r) => {
    map.set(String(r.downtime_date).slice(0, 10), Number(r.setup_seconds) || 0);
  });
  return map;
}
