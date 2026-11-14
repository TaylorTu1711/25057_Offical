import { parseReal } from './numeric.js';
import { DTR_MACHINES_TABLE, SCHEMA, ensureDtrSchema, qualifyTable } from './machineSchema.js';

const SAFE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;

/** Khoảng tối thiểu giữa 2 bản ghi lịch sử (PLC có thể gửi dày). */
export const DTR_TELEMETRY_MIN_INTERVAL_MS = 10_000;

export function dtrTelemetryTableRef(machineId) {
  const id = String(machineId || '').trim();
  if (!SAFE_ID_RE.test(id)) {
    throw new Error(`machine_id không hợp lệ cho bảng telemetry: ${id}`);
  }
  return qualifyTable(SCHEMA.DTR, id);
}

/** Payload sort DTR: có object counts. */
export function isDtrCountsRow(row) {
  if (!row || typeof row !== 'object') return false;
  const counts = row.counts;
  return counts != null && typeof counts === 'object' && !Array.isArray(counts);
}

/**
 * Map payload machine_id → registry id trong dtr.machines.
 * Hỗ trợ exact (`25231`) hoặc dạng `25231_100_70_140_122` (id + IP Tailscale).
 */
export async function resolveDtrRegistryMachineId(db, payloadMachineId) {
  const raw = String(payloadMachineId || '').trim();
  if (!raw) return null;

  const exact = await db.query(
    `SELECT machine_id FROM ${DTR_MACHINES_TABLE} WHERE machine_id = $1`,
    [raw],
  );
  if (exact.rowCount > 0) return exact.rows[0].machine_id;

  const ipSuffix = raw.match(/^(.+)_(\d{1,3}_\d{1,3}_\d{1,3}_\d{1,3})$/);
  if (ipSuffix) {
    const candidate = ipSuffix[1];
    const byPrefix = await db.query(
      `SELECT machine_id FROM ${DTR_MACHINES_TABLE} WHERE machine_id = $1`,
      [candidate],
    );
    if (byPrefix.rowCount > 0) return byPrefix.rows[0].machine_id;
  }

  return null;
}

function intOrNull(value) {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function normalizeCounts(counts) {
  if (!counts || typeof counts !== 'object' || Array.isArray(counts)) return {};
  const out = {};
  for (const [key, value] of Object.entries(counts)) {
    const code = String(key || '').trim();
    if (!code) continue;
    const n = parseReal(value);
    out[code] = n == null ? 0 : n;
  }
  return out;
}

/**
 * Ghi 1 dòng telemetry DTR.
 * - UPDATE registry (status / last_updated) do caller.
 * - INSERT khi chưa có dòng / status đổi / đủ ≥ 10s.
 * @returns {{ saved: boolean, reason?: string, registryId?: string }}
 */
export async function saveDtrTelemetryRow(db, payloadMachineId, row) {
  const registryId = await resolveDtrRegistryMachineId(db, payloadMachineId);
  if (!registryId) {
    return { saved: false, reason: 'machine_not_found' };
  }

  await ensureDtrTelemetryTable(db, registryId);
  const table = dtrTelemetryTableRef(registryId);

  const timestamp = row.timestamp ?? null;
  let rowTs = null;
  if (timestamp != null && timestamp !== '') {
    rowTs = new Date(timestamp);
    if (Number.isNaN(rowTs.getTime())) {
      return { saved: false, reason: 'invalid_timestamp', registryId };
    }
  }

  const status = intOrNull(row.status);
  const timeOn = intOrNull(row.time_on);
  const timeRunning = intOrNull(row.time_running);
  const counts = normalizeCounts(row.counts);

  const { rows: lastRows } = await db.query(
    `SELECT timestamp, status
     FROM ${table}
     ORDER BY timestamp DESC NULLS LAST, id DESC
     LIMIT 1`,
  );
  const last = lastRows[0];
  if (last) {
    const lastTs = last.timestamp != null ? new Date(last.timestamp).getTime() : NaN;
    const curTs = rowTs != null ? rowTs.getTime() : Date.now();
    const lastStatus = intOrNull(last.status);
    const statusChanged =
      status != null && (lastStatus == null || lastStatus !== status);
    const elapsedOk =
      !Number.isFinite(lastTs) || (curTs - lastTs) >= DTR_TELEMETRY_MIN_INTERVAL_MS;

    if (!statusChanged && !elapsedOk) {
      return { saved: false, reason: 'throttled', registryId };
    }
  }

  await db.query(
    `INSERT INTO ${table}
      (nr, machine_id, timestamp, status, time_on, time_running, counts)
     VALUES (
       $1, $2, COALESCE($3::timestamp, CURRENT_TIMESTAMP), $4, $5, $6, $7::jsonb
     )`,
    [
      intOrNull(row.nr),
      registryId,
      timestamp || null,
      status,
      timeOn,
      timeRunning,
      JSON.stringify(counts),
    ],
  );

  return {
    saved: true,
    reason: status != null && last && intOrNull(last.status) !== status
      ? 'status_change'
      : 'interval',
    registryId,
  };
}

/**
 * Bảng telemetry 1 máy DTR Sort — lưu snapshot từ PLC/Node-RED.
 * counts: JSONB { "b1_kn": 2000, "zz_nap": 221, ... }
 */
export async function ensureDtrTelemetryTable(db, machineId) {
  await ensureDtrSchema(db);
  const table = dtrTelemetryTableRef(machineId);

  await db.query(`
    CREATE TABLE IF NOT EXISTS ${table} (
      id SERIAL PRIMARY KEY,
      nr INTEGER,
      machine_id VARCHAR(64) NOT NULL,
      timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      status INTEGER,
      time_on INTEGER,
      time_running INTEGER,
      counts JSONB NOT NULL DEFAULT '{}'::jsonb
    )
  `);

  await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS nr INTEGER`);
  await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS status INTEGER`);
  await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS time_on INTEGER`);
  await db.query(`ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS time_running INTEGER`);
  await db.query(
    `ALTER TABLE ${table} ADD COLUMN IF NOT EXISTS counts JSONB NOT NULL DEFAULT '{}'::jsonb`,
  );

  await db.query(`
    CREATE INDEX IF NOT EXISTS "idx_${String(machineId).trim()}_ts"
    ON ${table} (timestamp DESC)
  `);

  return table;
}

/** Tạo bảng telemetry khi thêm máy DTR (không tạo alarm). */
export async function ensureDtrMachineDataTables(db, machineId) {
  const telemetry = await ensureDtrTelemetryTable(db, machineId);
  return { telemetry };
}

export async function dropDtrMachineDataTables(db, machineId) {
  const telemetry = dtrTelemetryTableRef(machineId);
  await db.query(`DROP TABLE IF EXISTS ${telemetry}`);
}

/** Backfill bảng telemetry cho mọi máy trong dtr.machines. */
export async function ensureAllDtrTelemetryTables(db) {
  await ensureDtrSchema(db);
  const { rows } = await db.query(
    `SELECT machine_id FROM ${DTR_MACHINES_TABLE} ORDER BY machine_id`,
  );
  for (const row of rows) {
    await ensureDtrMachineDataTables(db, row.machine_id);
  }
  return rows.length;
}

/** Thứ tự legend mặc định (khớp UI biểu đồ loại chai). */
export const DTR_COUNT_KEYS = [
  'b1_kn',
  'zz_nap',
  'b1_nl',
  'b5_nl',
  'b5_kn',
  'no_classify',
  'b1_nn',
  'ptp',
  'b4_kn',
  'b4_nl',
  'b1_oh',
  'b5_nn',
  'hu_nl',
  'hu_kn',
  'zz_cochai',
  'b4_nn',
  'b4_oh',
];

function normalizeCountsObject(counts) {
  const src = counts && typeof counts === 'object' && !Array.isArray(counts) ? counts : {};
  const out = {};
  for (const key of DTR_COUNT_KEYS) {
    const n = Number(src[key]);
    out[key] = Number.isFinite(n) ? n : 0;
  }
  // Giữ thêm key lạ nếu PLC gửi ngoài catalog
  for (const [key, value] of Object.entries(src)) {
    const code = String(key || '').trim().toLowerCase();
    if (!code || Object.prototype.hasOwnProperty.call(out, code)) continue;
    const n = Number(value);
    out[code] = Number.isFinite(n) ? n : 0;
  }
  return out;
}

function floorToHour(date) {
  const d = new Date(date);
  d.setMinutes(0, 0, 0);
  return d;
}

function hourLabel(date) {
  return `${String(date.getHours()).padStart(2, '0')}h`;
}

/** Các năm có dữ liệu telemetry trong Postgres (DESC). */
export async function getDtrTelemetryYears(db, machineId) {
  const registryId = await resolveDtrRegistryMachineId(db, machineId);
  if (!registryId) return [];

  await ensureDtrTelemetryTable(db, registryId);
  const table = dtrTelemetryTableRef(registryId);
  const { rows } = await db.query(
    `SELECT DISTINCT EXTRACT(YEAR FROM timestamp)::int AS year
     FROM ${table}
     WHERE timestamp IS NOT NULL
     ORDER BY year DESC`,
  );
  return rows
    .map((r) => Number(r.year))
    .filter((y) => Number.isFinite(y));
}

/** Match bottle chart UI - exclude from cumulative production. */
const DTR_PRODUCTION_EXCLUDED_KEYS = new Set(['zz_cochai', 'zz_nap']);

/**
 * SẢN LƯỢNG LŨY KẾ = tổng sản lượng mọi ngày (không gồm zz_cochai, zz_nap).
 * Mỗi ngày = (snapshot cuối ngày − snapshot đầu ngày) theo từng loại chai (delta ≥ 0).
 */
async function getDtrLifetimeDailyProductionTotal(db, table) {
  const [firstRes, lastRes] = await Promise.all([
    db.query(
      `SELECT DISTINCT ON (date_trunc('day', timestamp))
         date_trunc('day', timestamp) AS bucket,
         counts
       FROM ${table}
       WHERE timestamp IS NOT NULL
       ORDER BY date_trunc('day', timestamp), timestamp ASC, id ASC`,
    ),
    db.query(
      `SELECT DISTINCT ON (date_trunc('day', timestamp))
         date_trunc('day', timestamp) AS bucket,
         counts
       FROM ${table}
       WHERE timestamp IS NOT NULL
       ORDER BY date_trunc('day', timestamp), timestamp DESC, id DESC`,
    ),
  ]);

  const firstByDay = new Map();
  for (const row of firstRes.rows) {
    const ts = new Date(row.bucket).getTime();
    if (!Number.isFinite(ts)) continue;
    firstByDay.set(ts, normalizeCountsObject(row.counts));
  }

  let total = 0;
  for (const row of lastRes.rows) {
    const ts = new Date(row.bucket).getTime();
    if (!Number.isFinite(ts)) continue;
    const firstSnap = firstByDay.get(ts);
    if (!firstSnap) continue;
    const lastSnap = normalizeCountsObject(row.counts);
    const delta = diffCounts(firstSnap, lastSnap);
    for (const [key, value] of Object.entries(delta)) {
      if (DTR_PRODUCTION_EXCLUDED_KEYS.has(String(key).toLowerCase())) continue;
      total += Number(value) || 0;
    }
  }
  return total;
}

/**
 * THỜI GIAN LŨY KẾ = Σ (cuối ngày − đầu ngày) của time_on / time_running.
 * Giống sản lượng: mỗi ngày một delta ≥ 0 (hỗ trợ ngày backfill 12h).
 */
async function getDtrLifetimeDailyTimeTotals(db, table) {
  const [firstRes, lastRes] = await Promise.all([
    db.query(
      `SELECT DISTINCT ON (date_trunc('day', timestamp))
         date_trunc('day', timestamp) AS bucket,
         time_on,
         time_running
       FROM ${table}
       WHERE timestamp IS NOT NULL
       ORDER BY date_trunc('day', timestamp), timestamp ASC, id ASC`,
    ),
    db.query(
      `SELECT DISTINCT ON (date_trunc('day', timestamp))
         date_trunc('day', timestamp) AS bucket,
         time_on,
         time_running
       FROM ${table}
       WHERE timestamp IS NOT NULL
       ORDER BY date_trunc('day', timestamp), timestamp DESC, id DESC`,
    ),
  ]);

  const firstByDay = new Map();
  for (const row of firstRes.rows) {
    const ts = new Date(row.bucket).getTime();
    if (!Number.isFinite(ts)) continue;
    firstByDay.set(ts, {
      time_on: Number(row.time_on) || 0,
      time_running: Number(row.time_running) || 0,
    });
  }

  let timeOn = 0;
  let timeRunning = 0;
  for (const row of lastRes.rows) {
    const ts = new Date(row.bucket).getTime();
    if (!Number.isFinite(ts)) continue;
    const first = firstByDay.get(ts);
    if (!first) continue;
    const lastOn = Number(row.time_on) || 0;
    const lastRun = Number(row.time_running) || 0;
    timeOn += Math.max(0, lastOn - first.time_on);
    timeRunning += Math.max(0, lastRun - first.time_running);
  }
  return { time_on: timeOn, time_running: timeRunning };
}

/** Parse timestamp/date từ PG (string hoặc Date) → Date hợp lệ, hoặc null. */
function parsePgDateTime(raw) {
  if (raw == null || raw === '') return null;
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw;
  }
  const str = String(raw).trim();
  if (!str) return null;
  // DATE YYYY-MM-DD → đầu ngày local
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const d = new Date(`${str}T00:00:00`);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(str);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Live KPI: HIỆU SUẤT SỬ DỤNG + THỜI GIAN CHẠY LŨY KẾ
 * HIỆU SUẤT = thời gian chạy lũy kế / (now − ngày bàn giao).
 * Không có ngày bàn giao → mẫu số = (now − bản ghi telemetry cũ nhất).
 */
export async function getDtrUtilizationSummary(db, machineId) {
  const registryId = await resolveDtrRegistryMachineId(db, machineId);
  if (!registryId) {
    return null;
  }

  const machineRes = await db.query(
    `SELECT machine_id, created_at, status, last_updated, handover_date
     FROM ${DTR_MACHINES_TABLE}
     WHERE machine_id = $1`,
    [registryId],
  );
  const machine = machineRes.rows[0];
  if (!machine) return null;

  await ensureDtrTelemetryTable(db, registryId);
  const table = dtrTelemetryTableRef(registryId);
  const [latestRes, firstRes, totalCounts, dailyTime] = await Promise.all([
    db.query(
      `SELECT time_running, time_on, status, timestamp, counts
       FROM ${table}
       ORDER BY timestamp DESC NULLS LAST, id DESC
       LIMIT 1`,
    ),
    db.query(
      `SELECT timestamp, time_running, time_on
       FROM ${table}
       WHERE timestamp IS NOT NULL
       ORDER BY timestamp ASC, id ASC
       LIMIT 1`,
    ),
    getDtrLifetimeDailyProductionTotal(db, table),
    getDtrLifetimeDailyTimeTotals(db, table),
  ]);
  const latest = latestRes.rows[0] || null;
  const first = firstRes.rows[0] || null;
  const firstTsRaw = first?.timestamp ?? null;
  const handoverRaw = machine.handover_date ?? null;

  const timeRunning = Number(dailyTime.time_running) || 0;
  const timeOn = Number(dailyTime.time_on) || 0;
  const latestRunning = Number(latest?.time_running) || 0;
  const latestOn = Number(latest?.time_on) || 0;

  const counts = normalizeCountsObject(latest?.counts);
  const firstAt = parsePgDateTime(firstTsRaw);
  const handoverAt = parsePgDateTime(handoverRaw);
  const now = new Date();

  const denomStart = handoverAt || firstAt;
  const denomSource = handoverAt ? 'handover_date' : (firstAt ? 'first_telemetry' : null);
  const elapsedSeconds =
    denomStart
      ? Math.max(0, Math.floor((now.getTime() - denomStart.getTime()) / 1000))
      : 0;

  let utilizationPct = 0;
  if (elapsedSeconds > 0) {
    utilizationPct = (timeRunning / elapsedSeconds) * 100;
  }
  if (!Number.isFinite(utilizationPct) || utilizationPct < 0) utilizationPct = 0;
  utilizationPct = Number(utilizationPct.toFixed(2));

  return {
    machine_id: registryId,
    created_at: machine.created_at,
    handover_date: handoverRaw,
    first_telemetry_at: firstTsRaw,
    utilization_denom_source: denomSource,
    elapsed_seconds: elapsedSeconds,
    /** THỜI GIAN CHẠY LŨY KẾ = Σ (cuối ngày − đầu ngày) */
    time_running: timeRunning,
    time_on: timeOn,
    time_running_since_first: timeRunning,
    time_on_since_first: timeOn,
    time_running_latest: latestRunning,
    time_on_latest: latestOn,
    counts,
    /** SẢN LƯỢNG LŨY KẾ = Σ (cuối ngày − đầu ngày) mọi ngày */
    total_counts: totalCounts,
    status: latest?.status ?? machine.status ?? null,
    last_telemetry_at: latest?.timestamp ?? null,
    last_updated: machine.last_updated,
    /** HIỆU SUẤT SỬ DỤNG = time_running lũy kế / (now − bàn giao | dữ liệu cũ nhất) */
    utilization_pct: utilizationPct,
    available_years: await getDtrTelemetryYears(db, registryId),
  };
}

export async function getDtrPeriodUtilization(
  db,
  machineId,
  { mode = 'hour', year, month, day } = {},
) {
  const registryId = await resolveDtrRegistryMachineId(db, machineId);
  if (!registryId) {
    return {
      registryId: null,
      period_utilization_pct: 0,
      period_time_running: 0,
      period_seconds: 0,
      from: null,
      to: null,
    };
  }

  await ensureDtrTelemetryTable(db, registryId);
  const table = dtrTelemetryTableRef(registryId);
  const viewMode = COUNT_VIEW_MODES.has(String(mode)) ? String(mode) : 'hour';
  const plan = buildCountBuckets(viewMode, { year, month, day });

  const now = new Date();
  let rangeStart = plan.rangeStart;
  let rangeEnd = plan.rangeEnd;
  // Khung đang diễn ra: chỉ tính đến hiện tại (không lấy cả ngày/tháng tương lai)
  if (rangeEnd.getTime() > now.getTime()) {
    rangeEnd = now;
  }
  if (rangeStart.getTime() > rangeEnd.getTime()) {
    return {
      registryId,
      mode: viewMode,
      period_utilization_pct: 0,
      period_time_running: 0,
      period_seconds: 0,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
    };
  }

  const periodSeconds = Math.max(
    0,
    Math.floor((rangeEnd.getTime() - rangeStart.getTime()) / 1000),
  );

  // Snapshot time_running ngay trước khoảng (baseline)
  const beforeRes = await db.query(
    `SELECT time_running
     FROM ${table}
     WHERE timestamp < $1 AND time_running IS NOT NULL
     ORDER BY timestamp DESC, id DESC
     LIMIT 1`,
    [rangeStart],
  );
  // Snapshot đầu trong khoảng (nếu không có baseline)
  const firstRes = await db.query(
    `SELECT time_running
     FROM ${table}
     WHERE timestamp >= $1 AND timestamp <= $2 AND time_running IS NOT NULL
     ORDER BY timestamp ASC, id ASC
     LIMIT 1`,
    [rangeStart, rangeEnd],
  );
  const lastRes = await db.query(
    `SELECT time_running
     FROM ${table}
     WHERE timestamp >= $1 AND timestamp <= $2 AND time_running IS NOT NULL
     ORDER BY timestamp DESC, id DESC
     LIMIT 1`,
    [rangeStart, rangeEnd],
  );

  const beforeRun = beforeRes.rows[0]?.time_running != null
    ? Number(beforeRes.rows[0].time_running)
    : null;
  const firstRun = firstRes.rows[0]?.time_running != null
    ? Number(firstRes.rows[0].time_running)
    : null;
  const lastRun = lastRes.rows[0]?.time_running != null
    ? Number(lastRes.rows[0].time_running)
    : null;

  const startRun = Number.isFinite(beforeRun)
    ? beforeRun
    : (Number.isFinite(firstRun) ? firstRun : null);
  const endRun = Number.isFinite(lastRun) ? lastRun : startRun;

  let deltaRun = 0;
  if (startRun != null && endRun != null) {
    deltaRun = endRun >= startRun ? endRun - startRun : Math.max(0, endRun);
  }
  if (!Number.isFinite(deltaRun) || deltaRun < 0) deltaRun = 0;

  let pct = 0;
  if (periodSeconds > 0) {
    pct = (deltaRun / periodSeconds) * 100;
  }
  if (!Number.isFinite(pct) || pct < 0) pct = 0;
  pct = Number(pct.toFixed(2));

  return {
    registryId,
    mode: viewMode,
    period_utilization_pct: pct,
    period_time_running: deltaRun,
    period_seconds: periodSeconds,
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
  };
}

/**
 * Chuỗi status theo thời gian (biểu đồ chạy/dừng).
 * DTR: 0 = dừng, 1 = chạy.
 * Hỗ trợ { from, to } ISO hoặc { hours } (mặc định 24h gần nhất).
 *
 * Khoảng không có telemetry (gap > DTR_STATUS_GAP_MS) → ép status = 0 (dừng),
 * kể cả đoạn từ mẫu cuối đến hết cửa sổ xem.
 */
/** Ngưỡng mất dữ liệu — khớp isMachineConnected (~2 phút). */
const DTR_STATUS_GAP_MS = 2 * 60_000;

function pushStatusPoint(timestamps, statusValues, ts, status) {
  const t = Number(ts);
  const s = Number(status);
  if (!Number.isFinite(t) || (s !== 0 && s !== 1)) return;
  const lastI = timestamps.length - 1;
  if (lastI >= 0) {
    if (timestamps[lastI] === t) {
      statusValues[lastI] = s;
      return;
    }
    if (t < timestamps[lastI]) return;
  }
  timestamps.push(t);
  statusValues.push(s);
}

export async function getDtrStatusTimeline(db, machineId, { hours = 24, from, to } = {}) {
  const registryId = await resolveDtrRegistryMachineId(db, machineId);
  if (!registryId) {
    return { registryId: null, timestamps: [], statusValues: [], from: null, to: null };
  }

  await ensureDtrTelemetryTable(db, registryId);
  const table = dtrTelemetryTableRef(registryId);

  let rangeStart;
  let rangeEnd;
  if (from || to) {
    rangeEnd = to ? new Date(to) : new Date();
    rangeStart = from
      ? new Date(from)
      : new Date(rangeEnd.getTime() - 24 * 3600_000);
    if (Number.isNaN(rangeStart.getTime())) rangeStart = new Date(Date.now() - 24 * 3600_000);
    if (Number.isNaN(rangeEnd.getTime())) rangeEnd = new Date();
    if (rangeStart.getTime() > rangeEnd.getTime()) {
      const tmp = rangeStart;
      rangeStart = rangeEnd;
      rangeEnd = tmp;
    }
  } else {
    const hourCount = Math.min(Math.max(Number(hours) || 24, 1), 168);
    rangeEnd = new Date();
    rangeStart = new Date(rangeEnd.getTime() - hourCount * 3600_000);
  }

  const rangeStartMs = rangeStart.getTime();
  const rangeEndMs = rangeEnd.getTime();

  const [{ rows }, beforeRes] = await Promise.all([
    db.query(
      `SELECT timestamp, status
       FROM ${table}
       WHERE timestamp >= $1 AND timestamp <= $2 AND status IS NOT NULL
       ORDER BY timestamp ASC, id ASC`,
      [rangeStart, rangeEnd],
    ),
    db.query(
      `SELECT timestamp, status
       FROM ${table}
       WHERE timestamp < $1 AND status IS NOT NULL
       ORDER BY timestamp DESC, id DESC
       LIMIT 1`,
      [rangeStart],
    ),
  ]);

  const samples = [];
  for (const row of rows) {
    const ts = row.timestamp != null ? new Date(row.timestamp).getTime() : NaN;
    if (!Number.isFinite(ts)) continue;
    const s = Number(row.status);
    if (s !== 0 && s !== 1) continue;
    samples.push({ ts, status: s });
  }

  const before = beforeRes.rows[0] || null;
  let prevTs = null;
  let prevStatus = null;
  if (before?.timestamp != null) {
    const bts = new Date(before.timestamp).getTime();
    const bs = Number(before.status);
    if (Number.isFinite(bts) && (bs === 0 || bs === 1)) {
      prevTs = bts;
      prevStatus = bs;
    }
  }

  const timestamps = [];
  const statusValues = [];

  // Trạng thái tại đầu cửa sổ
  if (prevTs != null) {
    const age = rangeStartMs - prevTs;
    pushStatusPoint(
      timestamps,
      statusValues,
      rangeStartMs,
      age > DTR_STATUS_GAP_MS ? 0 : prevStatus,
    );
    if (age > DTR_STATUS_GAP_MS) {
      prevStatus = 0;
      prevTs = rangeStartMs;
    } else {
      prevTs = rangeStartMs;
    }
  } else if (samples.length === 0) {
    // Không có dữ liệu trong/ trước khoảng → cả cửa sổ = dừng
    pushStatusPoint(timestamps, statusValues, rangeStartMs, 0);
    pushStatusPoint(timestamps, statusValues, rangeEndMs, 0);
    return {
      registryId,
      timestamps,
      statusValues,
      from: rangeStart.toISOString(),
      to: rangeEnd.toISOString(),
    };
  }

  for (const sample of samples) {
    if (prevTs != null) {
      const gap = sample.ts - prevTs;
      if (gap > DTR_STATUS_GAP_MS) {
        const stopAt = prevTs + DTR_STATUS_GAP_MS;
        if (stopAt < sample.ts) {
          pushStatusPoint(timestamps, statusValues, stopAt, 0);
        }
        // Neo dừng sát trước mẫu mới để step chart hạ xuống 0
        if (sample.ts - 1 > (timestamps[timestamps.length - 1] || 0)) {
          pushStatusPoint(timestamps, statusValues, sample.ts - 1, 0);
        }
      }
    } else if (sample.ts > rangeStartMs) {
      // Có mẫu đầu tiên sau đầu cửa sổ, trước đó không seed → đoạn đầu = dừng
      pushStatusPoint(timestamps, statusValues, rangeStartMs, 0);
      if (sample.ts - rangeStartMs > DTR_STATUS_GAP_MS) {
        pushStatusPoint(timestamps, statusValues, sample.ts - 1, 0);
      }
    }

    pushStatusPoint(timestamps, statusValues, sample.ts, sample.status);
    prevTs = sample.ts;
    prevStatus = sample.status;
  }

  // Từ mẫu cuối → hết cửa sổ
  if (prevTs != null) {
    const tailGap = rangeEndMs - prevTs;
    if (tailGap > DTR_STATUS_GAP_MS) {
      const stopAt = prevTs + DTR_STATUS_GAP_MS;
      if (stopAt < rangeEndMs) {
        pushStatusPoint(timestamps, statusValues, stopAt, 0);
      }
      pushStatusPoint(timestamps, statusValues, rangeEndMs, 0);
    } else if (rangeEndMs > prevTs) {
      pushStatusPoint(timestamps, statusValues, rangeEndMs, prevStatus);
    }
  }

  return {
    registryId,
    timestamps,
    statusValues,
    from: rangeStart.toISOString(),
    to: rangeEnd.toISOString(),
  };
}

const COUNT_VIEW_MODES = new Set(['hour', 'day', 'week', 'month', 'quarter', 'year']);

/** Delta counts ≥ 0 (PLC counts thường lũy kế). */
function diffCounts(prev, curr) {
  const a = prev || {};
  const b = curr || {};
  const keys = new Set([...Object.keys(a), ...Object.keys(b), ...DTR_COUNT_KEYS]);
  const out = {};
  for (const key of keys) {
    const d = (Number(b[key]) || 0) - (Number(a[key]) || 0);
    out[key] = d > 0 ? d : 0;
  }
  return out;
}

function emptyCounts() {
  return normalizeCountsObject({});
}

/**
 * Theo giờ: gắn snapshot cuối mỗi bucket → delta so với snapshot trước
 * (máy dừng / counts không đổi → cột = 0, không lặp số lũy kế).
 */
function snapshotsToDeltaBuckets(bucketDefs, snapshotByStartTs, baselineCounts) {
  let prev = baselineCounts || emptyCounts();
  return bucketDefs.map((b) => {
    const startTs = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
    const snap = snapshotByStartTs.get(startTs);
    if (!snap) {
      return {
        start: b.start instanceof Date ? b.start.toISOString() : b.start,
        label: b.label,
        counts: emptyCounts(),
      };
    }
    const delta = diffCounts(prev, snap);
    prev = snap;
    return {
      start: b.start instanceof Date ? b.start.toISOString() : b.start,
      label: b.label,
      counts: delta,
    };
  });
}

/**
 * Ngày / tuần / tháng / quý / năm:
 * mỗi cột = Σ (snapshot cuối − đầu) của từng đơn vị trunc nằm trong kỳ.
 * (Tránh lấy cuối kỳ − đầu kỳ cả khối: PLC reset giữa kỳ → cột tháng = 0
 * trong khi tổng các ngày vẫn > 0.)
 */
function snapshotsToPeriodSumOfUnitDeltas(bucketDefs, firstByTs, lastByTs) {
  const unitKeys = [
    ...new Set([...firstByTs.keys(), ...lastByTs.keys()]),
  ].sort((a, b) => a - b);

  return bucketDefs.map((b) => {
    const startTs = b.start instanceof Date ? b.start.getTime() : new Date(b.start).getTime();
    const endTs = b.end instanceof Date ? b.end.getTime() : new Date(b.end).getTime();
    const startIso = b.start instanceof Date ? b.start.toISOString() : b.start;
    const totals = emptyCounts();

    for (const ts of unitKeys) {
      if (ts < startTs || ts >= endTs) continue;
      const firstSnap = firstByTs.get(ts);
      const lastSnap = lastByTs.get(ts);
      if (!firstSnap || !lastSnap) continue;
      const delta = diffCounts(firstSnap, lastSnap);
      for (const [key, value] of Object.entries(delta)) {
        totals[key] = (Number(totals[key]) || 0) + (Number(value) || 0);
      }
    }

    return { start: startIso, label: b.label, counts: totals };
  });
}

function bucketKeyFromRow(rowBucket, trunc) {
  return trunc === 'hour'
    ? floorToHour(rowBucket).getTime()
    : new Date(rowBucket).getTime();
}

function mapTruncSnapshots(rows, trunc, extraKeys) {
  const map = new Map();
  for (const row of rows) {
    const counts = normalizeCountsObject(row.counts);
    map.set(bucketKeyFromRow(row.bucket, trunc), counts);
    for (const key of Object.keys(counts)) {
      if (!DTR_COUNT_KEYS.includes(key)) extraKeys.add(key);
    }
  }
  return map;
}

function buildCountBuckets(mode, { year, month, day } = {}) {
  const now = new Date();
  const y = Number(year) || now.getFullYear();
  const m = Math.min(12, Math.max(1, Number(month) || now.getMonth() + 1));
  const d = Math.min(31, Math.max(1, Number(day) || now.getDate()));

  if (mode === 'hour') {
    const rangeStart = new Date(y, m - 1, d, 0, 0, 0, 0);
    const rangeEnd = new Date(y, m - 1, d + 1, 0, 0, 0, 0);
    const buckets = [];
    for (let h = 0; h < 24; h += 1) {
      const start = new Date(y, m - 1, d, h, 0, 0, 0);
      buckets.push({
        start,
        end: new Date(start.getTime() + 3600_000),
        label: `${String(h).padStart(2, '0')}h`,
      });
    }
    return { trunc: 'hour', rangeStart, rangeEnd, buckets };
  }

  if (mode === 'day') {
    const daysInMonth = new Date(y, m, 0).getDate();
    const rangeStart = new Date(y, m - 1, 1);
    const rangeEnd = new Date(y, m, 1);
    const buckets = [];
    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const start = new Date(y, m - 1, dayNum);
      buckets.push({
        start,
        end: new Date(y, m - 1, dayNum + 1),
        label: String(dayNum).padStart(2, '0'),
      });
    }
    return { trunc: 'day', rangeStart, rangeEnd, buckets };
  }

  if (mode === 'week') {
    const daysInMonth = new Date(y, m, 0).getDate();
    const weekCount = Math.ceil(daysInMonth / 7);
    const rangeStart = new Date(y, m - 1, 1);
    const rangeEnd = new Date(y, m, 1);
    const buckets = [];
    for (let w = 0; w < weekCount; w += 1) {
      const fromDay = w * 7 + 1;
      const toDay = Math.min((w + 1) * 7, daysInMonth);
      buckets.push({
        start: new Date(y, m - 1, fromDay),
        end: new Date(y, m - 1, toDay + 1),
        label: `T${w + 1}`,
      });
    }
    // trunc day: mỗi tuần = snapshot cuối tuần − snapshot đầu tuần
    return { trunc: 'day', rangeStart, rangeEnd, buckets };
  }

  if (mode === 'month') {
    const rangeStart = new Date(y, 0, 1);
    const rangeEnd = new Date(y + 1, 0, 1);
    const buckets = [];
    for (let mo = 0; mo < 12; mo += 1) {
      buckets.push({
        start: new Date(y, mo, 1),
        end: new Date(y, mo + 1, 1),
        label: String(mo + 1).padStart(2, '0'),
      });
    }
    // trunc day → cột tháng = tổng delta các ngày trong tháng
    return { trunc: 'day', rangeStart, rangeEnd, buckets };
  }

  if (mode === 'quarter') {
    const rangeStart = new Date(y, 0, 1);
    const rangeEnd = new Date(y + 1, 0, 1);
    const buckets = [];
    for (let q = 0; q < 4; q += 1) {
      buckets.push({
        start: new Date(y, q * 3, 1),
        end: new Date(y, q * 3 + 3, 1),
        label: `Q${q + 1}`,
      });
    }
    return { trunc: 'day', rangeStart, rangeEnd, buckets };
  }

  // year: 5 năm gần nhất (tính theo year chọn hoặc năm hiện tại)
  const endY = y;
  const startY = endY - 4;
  const rangeStart = new Date(startY, 0, 1);
  const rangeEnd = new Date(endY + 1, 0, 1);
  const buckets = [];
  for (let yr = startY; yr <= endY; yr += 1) {
    buckets.push({
      start: new Date(yr, 0, 1),
      end: new Date(yr + 1, 0, 1),
      label: String(yr),
    });
  }
  return { trunc: 'day', rangeStart, rangeEnd, buckets };
}

/**
 * Thống kê số chai theo mode: hour | day | week | month | quarter | year.
 * - hour: delta xích giữa các giờ (snapshot cuối giờ − giờ trước)
 * - day: mỗi cột = cuối ngày − đầu ngày
 * - week/month/quarter/year: mỗi cột = tổng delta các ngày trong kỳ
 */
export async function getDtrCountsSeries(
  db,
  machineId,
  { mode = 'hour', year, month, day, hours = 24 } = {},
) {
  const registryId = await resolveDtrRegistryMachineId(db, machineId);
  if (!registryId) {
    return { registryId: null, mode, buckets: [], keys: DTR_COUNT_KEYS };
  }

  await ensureDtrTelemetryTable(db, registryId);
  const table = dtrTelemetryTableRef(registryId);

  const viewMode = COUNT_VIEW_MODES.has(String(mode)) ? String(mode) : 'hour';
  const usePeriodFirstLast = viewMode !== 'hour';

  let plan;
  // Giữ tương thích cũ: không truyền year/month → 24h gần nhất
  if (
    viewMode === 'hour'
    && (year == null || year === '')
    && (month == null || month === '')
    && (day == null || day === '')
  ) {
    const hourCount = Math.min(Math.max(Number(hours) || 24, 1), 168);
    const now = new Date();
    const endHour = floorToHour(now);
    const startHour = new Date(endHour.getTime() - (hourCount - 1) * 3600_000);
    const buckets = [];
    for (let i = 0; i < hourCount; i += 1) {
      const start = new Date(startHour.getTime() + i * 3600_000);
      buckets.push({
        start,
        end: new Date(start.getTime() + 3600_000),
        label: hourLabel(start),
      });
    }
    plan = {
      trunc: 'hour',
      rangeStart: startHour,
      rangeEnd: new Date(endHour.getTime() + 3600_000),
      buckets,
    };
  } else {
    plan = buildCountBuckets(viewMode, { year, month, day });
  }

  const extraKeys = new Set();

  if (usePeriodFirstLast) {
    const [firstRes, lastRes] = await Promise.all([
      db.query(
        `SELECT DISTINCT ON (date_trunc($3::text, timestamp))
           date_trunc($3::text, timestamp) AS bucket,
           counts
         FROM ${table}
         WHERE timestamp >= $1 AND timestamp < $2
         ORDER BY date_trunc($3::text, timestamp), timestamp ASC, id ASC`,
        [plan.rangeStart, plan.rangeEnd, plan.trunc],
      ),
      db.query(
        `SELECT DISTINCT ON (date_trunc($3::text, timestamp))
           date_trunc($3::text, timestamp) AS bucket,
           counts
         FROM ${table}
         WHERE timestamp >= $1 AND timestamp < $2
         ORDER BY date_trunc($3::text, timestamp), timestamp DESC, id DESC`,
        [plan.rangeStart, plan.rangeEnd, plan.trunc],
      ),
    ]);

    const firstByTs = mapTruncSnapshots(firstRes.rows, plan.trunc, extraKeys);
    const lastByTs = mapTruncSnapshots(lastRes.rows, plan.trunc, extraKeys);
    const outBuckets = snapshotsToPeriodSumOfUnitDeltas(
      plan.buckets,
      firstByTs,
      lastByTs,
    );

    return {
      registryId,
      mode: viewMode,
      buckets: outBuckets,
      hours: outBuckets,
      keys: [...DTR_COUNT_KEYS, ...[...extraKeys].sort()],
    };
  }

  // hour: baseline trước khoảng + delta xích theo giờ
  const baselineRes = await db.query(
    `SELECT counts
     FROM ${table}
     WHERE timestamp < $1
     ORDER BY timestamp DESC, id DESC
     LIMIT 1`,
    [plan.rangeStart],
  );
  const baselineCounts = normalizeCountsObject(baselineRes.rows[0]?.counts);

  const { rows } = await db.query(
    `SELECT DISTINCT ON (date_trunc($3::text, timestamp))
       date_trunc($3::text, timestamp) AS bucket,
       counts
     FROM ${table}
     WHERE timestamp >= $1 AND timestamp < $2
     ORDER BY date_trunc($3::text, timestamp), timestamp DESC, id DESC`,
    [plan.rangeStart, plan.rangeEnd, plan.trunc],
  );

  const byBucket = mapTruncSnapshots(rows, plan.trunc, extraKeys);
  const outBuckets = snapshotsToDeltaBuckets(plan.buckets, byBucket, baselineCounts);

  return {
    registryId,
    mode: viewMode,
    buckets: outBuckets,
    hours: outBuckets,
    keys: [...DTR_COUNT_KEYS, ...[...extraKeys].sort()],
  };
}

/** @deprecated dùng getDtrCountsSeries */
export async function getDtrCountsHourlySeries(db, machineId, opts = {}) {
  return getDtrCountsSeries(db, machineId, { mode: 'hour', ...opts });
}
