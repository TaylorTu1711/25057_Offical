import pool from '../db.js';

export const ROLES = {
  ADMIN: 'admin',
  FACTORY: 'factory',
  MAINTENANCE: 'maintenance',
};

export function isMaintenanceRole(role) {
  return role === ROLES.MAINTENANCE;
}

export function vietnamDateKey(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export async function ensureDailySetupTable(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS cnc.machine_daily_setup (
      machine_id VARCHAR(255) NOT NULL,
      setup_date DATE NOT NULL,
      setup_seconds INTEGER NOT NULL DEFAULT 0,
      updated_by INT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (machine_id, setup_date)
    )
  `);
}

function dateKeyFromRow(row) {
  const raw = row?.date_key || row?.timestamp || row?.setup_date;
  if (!raw) return '';
  return String(raw).slice(0, 10);
}

export async function fetchDailySetupMap(db, machineId, fromDate, toDate) {
  await ensureDailySetupTable(db);
  const params = [machineId];
  const where = ['machine_id = $1'];
  if (fromDate) {
    params.push(fromDate);
    where.push(`setup_date >= $${params.length}::date`);
  }
  if (toDate) {
    params.push(toDate);
    where.push(`setup_date <= $${params.length}::date`);
  }
  const { rows } = await db.query(
    `SELECT setup_date::text AS setup_date, setup_seconds, updated_at, updated_by
     FROM cnc.machine_daily_setup
     WHERE ${where.join(' AND ')}
     ORDER BY setup_date ASC`,
    params,
  );
  const map = new Map();
  rows.forEach((r) => {
    map.set(String(r.setup_date).slice(0, 10), Number(r.setup_seconds) || 0);
  });
  return { rows, map };
}

export async function fetchDailySetupForDate(db, machineId, dateKey) {
  await ensureDailySetupTable(db);
  const { rows } = await db.query(
    `SELECT setup_date::text AS setup_date, setup_seconds, updated_at, updated_by
     FROM cnc.machine_daily_setup
     WHERE machine_id = $1 AND setup_date = $2::date`,
    [machineId, dateKey],
  );
  return rows[0] || null;
}

export async function upsertDailySetup(db, {
  machineId,
  dateKey,
  setupSeconds,
  userId,
}) {
  await ensureDailySetupTable(db);
  const seconds = Math.max(0, Math.min(86400, Math.round(Number(setupSeconds) || 0)));
  const { rows } = await db.query(
    `INSERT INTO cnc.machine_daily_setup (machine_id, setup_date, setup_seconds, updated_by, updated_at)
     VALUES ($1, $2::date, $3, $4, CURRENT_TIMESTAMP)
     ON CONFLICT (machine_id, setup_date)
     DO UPDATE SET setup_seconds = EXCLUDED.setup_seconds,
                   updated_by = EXCLUDED.updated_by,
                   updated_at = CURRENT_TIMESTAMP
     RETURNING setup_date::text AS setup_date, setup_seconds, updated_at, updated_by`,
    [machineId, dateKey, seconds, userId || null],
  );
  return rows[0];
}

export async function sumDailySetupSeconds(db, machineId) {
  await ensureDailySetupTable(db);
  const { rows } = await db.query(
    `SELECT COALESCE(SUM(setup_seconds), 0)::int AS total
     FROM cnc.machine_daily_setup
     WHERE machine_id = $1`,
    [machineId],
  );
  return Number(rows[0]?.total) || 0;
}

/** Ghi đè time_setup của dòng daily bằng số maintenance đã nhập (nếu có). */
export async function overlayDailySetupOnRows(db, machineId, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows;
  const dates = rows.map(dateKeyFromRow).filter(Boolean);
  if (dates.length === 0) return rows;
  const from = dates.reduce((a, b) => (a < b ? a : b));
  const to = dates.reduce((a, b) => (a > b ? a : b));
  const { map } = await fetchDailySetupMap(db, machineId, from, to);
  if (map.size === 0) return rows;
  return rows.map((row) => {
    const key = dateKeyFromRow(row);
    if (!key || !map.has(key)) return row;
    return { ...row, time_setup: map.get(key) };
  });
}
