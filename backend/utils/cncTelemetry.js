import { alarmTableRef, telemetryTableRef } from './machineSchema.js';
import { parseReal } from './numeric.js';

function parseQualifiedTable(qualified) {
  const match = String(qualified).match(/^"([^"]+)"\."([^"]+)"$/);
  if (!match) {
    throw new Error(`Invalid qualified table: ${qualified}`);
  }
  return { schema: match[1], tableName: match[2] };
}

const CNC_ELECTRICAL_MARKERS = [
  'phase1_v', 'phase2_v', 'phase3_v', 'avg_v',
  'phase1_a', 'phase2_a', 'phase3_a', 'avg_a',
  'power', 'power_consumption', 'frequency', 'freq',
  'time_running',
];

/** Payload telemetry điện CNC từ Node-RED / PLC. */
export function isCncElectricalRow(row) {
  if (!row || typeof row !== 'object') return false;
  return CNC_ELECTRICAL_MARKERS.some((key) => Object.prototype.hasOwnProperty.call(row, key));
}

function numOrNull(value) {
  const n = parseReal(value);
  return n;
}

/** Chu kỳ tối thiểu giữa 2 bản ghi lịch sử điện (PLC có thể gửi 1s). */
export const CNC_TELEMETRY_MIN_INTERVAL_MS = 10_000;

/**
 * Ghi một dòng telemetry điện vào bảng máy CNC (schema cnc).
 * - Registry (live) được caller cập nhật mỗi lần nhận — độc lập với INSERT.
 * - INSERT khi: chưa có dòng / status đổi / đủ ≥ 10s kể từ bản ghi gần nhất.
 * @returns {{ saved: boolean, reason?: string }}
 */
export async function saveCncTelemetryRow(db, qualifiedTable, machineId, row) {
  const { schema, tableName } = parseQualifiedTable(qualifiedTable);

  if (!(await tableExists(db, schema, tableName))) {
    return { saved: false, reason: 'table_missing' };
  }

  await ensureCncElectricalTelemetryColumns(db, qualifiedTable);

  // Giữ nguyên chuỗi timestamp từ Orange Pi (vd: 2026-07-20 09:26:07.000)
  const timestamp = row.timestamp ?? null;
  let rowTs = null;
  if (timestamp != null && timestamp !== '') {
    rowTs = new Date(timestamp);
    if (Number.isNaN(rowTs.getTime())) {
      return { saved: false, reason: 'invalid_timestamp' };
    }
  }

  const frequency = numOrNull(row.frequency ?? row.freq);
  const status = row.status != null && row.status !== ''
    ? Number(row.status)
    : null;
  const statusVal = Number.isFinite(status) ? status : null;

  const { rows: lastRows } = await db.query(
    `SELECT timestamp, status
     FROM ${qualifiedTable}
     ORDER BY timestamp DESC NULLS LAST, id DESC
     LIMIT 1`,
  );
  const last = lastRows[0];
  if (last) {
    const lastTs = last.timestamp != null ? new Date(last.timestamp).getTime() : NaN;
    const curTs = rowTs != null ? rowTs.getTime() : Date.now();
    const lastStatus = last.status != null && last.status !== ''
      ? Number(last.status)
      : null;
    const statusChanged =
      statusVal != null
      && (lastStatus == null || Number(lastStatus) !== statusVal);
    const elapsedOk =
      !Number.isFinite(lastTs) || (curTs - lastTs) >= CNC_TELEMETRY_MIN_INTERVAL_MS;

    if (!statusChanged && !elapsedOk) {
      return { saved: false, reason: 'throttled' };
    }
  }

  await db.query(
    `INSERT INTO ${qualifiedTable} (
      nr, machine_id, timestamp, time_on, time_running,
      phase1_v, phase2_v, phase3_v, avg_v,
      phase1_a, phase2_a, phase3_a, avg_a,
      power, power_consumption, frequency, status
    ) VALUES (
      $1, $2, COALESCE($3::timestamp, CURRENT_TIMESTAMP), $4, $5,
      $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16, $17
    )`,
    [
      row.nr ?? null,
      machineId,
      timestamp || null,
      numOrNull(row.time_on),
      numOrNull(row.time_running),
      numOrNull(row.phase1_v),
      numOrNull(row.phase2_v),
      numOrNull(row.phase3_v),
      numOrNull(row.avg_v),
      numOrNull(row.phase1_a),
      numOrNull(row.phase2_a),
      numOrNull(row.phase3_a),
      numOrNull(row.avg_a),
      numOrNull(row.power),
      numOrNull(row.power_consumption),
      frequency,
      statusVal,
    ],
  );

  return { saved: true, reason: statusVal != null && last && Number(last.status) !== statusVal ? 'status_change' : 'interval' };
}

export async function tableExists(db, schema, tableName) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = $2`,
    [schema, tableName],
  );
  return rowCount > 0;
}

export async function tableHasColumn(db, schema, tableName, columnName) {
  const { rowCount } = await db.query(
    `SELECT 1 FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3`,
    [schema, tableName, columnName],
  );
  return rowCount > 0;
}

/** Cột telemetry điện CNC — dùng khi tạo máy mới / bổ sung bảng cũ. */
export const CNC_ELECTRICAL_COLUMNS = [
  ['nr', 'INTEGER'],
  ['machine_id', 'VARCHAR(255)'],
  ['timestamp', 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP'],
  ['time_on', 'INTEGER'],
  ['time_running', 'INTEGER'],
  ['phase1_v', 'REAL'],
  ['phase2_v', 'REAL'],
  ['phase3_v', 'REAL'],
  ['avg_v', 'REAL'],
  ['phase1_a', 'REAL'],
  ['phase2_a', 'REAL'],
  ['phase3_a', 'REAL'],
  ['avg_a', 'REAL'],
  ['power', 'REAL'],
  ['power_consumption', 'REAL'],
  ['frequency', 'REAL'],
  ['status', 'INTEGER'],
];

/** Đổi TIMESTAMPTZ → TIMESTAMP (không +07), giữ giờ tường VN. */
async function ensureTimestampWithoutTz(db, qualifiedTable, schema, tableName) {
  const { rows } = await db.query(
    `SELECT data_type FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = 'timestamp'`,
    [schema, tableName],
  );
  if (rows[0]?.data_type !== 'timestamp with time zone') return;

  await db.query(`
    ALTER TABLE ${qualifiedTable}
    ALTER COLUMN "timestamp" TYPE TIMESTAMP WITHOUT TIME ZONE
    USING ("timestamp" AT TIME ZONE 'Asia/Ho_Chi_Minh')
  `);
}

/**
 * Đảm bảo bảng telemetry CNC có đủ cột điện (gồm frequency).
 * @param {import('pg').Pool|import('pg').PoolClient} db
 * @param {string} qualifiedTable — ví dụ "cnc"."machine_id"
 */
export async function ensureCncElectricalTelemetryColumns(db, qualifiedTable) {
  const { schema, tableName } = parseQualifiedTable(qualifiedTable);
  if (!(await tableExists(db, schema, tableName))) return;

  for (const [column, typeSql] of CNC_ELECTRICAL_COLUMNS) {
    await db.query(
      `ALTER TABLE ${qualifiedTable} ADD COLUMN IF NOT EXISTS "${column}" ${typeSql}`,
    );
  }

  await ensureTimestampWithoutTz(db, qualifiedTable, schema, tableName);
}

/** Cột timestamp là giờ tường VN (không múi giờ). toISOString() là UTC nên phải +7. */
const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;

function toVietnamWallClock(date) {
  const shifted = new Date(date.getTime() + VIETNAM_OFFSET_MS);
  return shifted.toISOString().slice(0, 19).replace('T', ' ');
}

function normalizePayloadRow(row) {
  const payload = row.payload && typeof row.payload === 'object' ? row.payload : {};
  return {
    id: row.id,
    nr: payload.nr ?? row.nr ?? null,
    machine_id: row.machine_id,
    timestamp: row.timestamp,
    status: row.status ?? payload.status ?? null,
    shoot: Number(payload.shoot ?? row.shoot ?? 0),
    product: Number(payload.product ?? row.product ?? 0),
    time_on: Number(payload.time_on ?? row.time_on ?? 0),
    time_off: Number(payload.time_off ?? row.time_off ?? 0),
    time_running: Number(payload.time_running ?? row.time_running ?? 0),
    input_material: Number(payload.input_material ?? row.input_material ?? 0),
    cycle: Number(payload.cycle ?? row.cycle ?? 0),
    check_get: payload.check_get ?? row.check_get ?? false,
    phase1_v: Number(payload.phase1_v ?? row.phase1_v ?? 0),
    phase2_v: Number(payload.phase2_v ?? row.phase2_v ?? 0),
    phase3_v: Number(payload.phase3_v ?? row.phase3_v ?? 0),
    avg_v: Number(payload.avg_v ?? row.avg_v ?? 0),
    phase1_a: Number(payload.phase1_a ?? row.phase1_a ?? 0),
    phase2_a: Number(payload.phase2_a ?? row.phase2_a ?? 0),
    phase3_a: Number(payload.phase3_a ?? row.phase3_a ?? 0),
    avg_a: Number(payload.avg_a ?? row.avg_a ?? 0),
    power: Number(payload.power ?? row.power ?? 0),
    power_consumption: Number(payload.power_consumption ?? row.power_consumption ?? 0),
    frequency: Number(payload.frequency ?? row.frequency ?? payload.freq ?? row.freq ?? 0),
  };
}

export async function fetchCncTelemetryRows(db, machineId, machine, options = {}) {
  const qualified = telemetryTableRef(machineId, machine);
  const { schema, tableName } = parseQualifiedTable(qualified);

  if (!(await tableExists(db, schema, tableName))) {
    return [];
  }

  // Bảng cũ TIMESTAMPTZ → TIMESTAMP (hiển thị không còn +07)
  await ensureTimestampWithoutTz(db, qualified, schema, tableName);

  const hasLegacyColumns = await tableHasColumn(db, schema, tableName, 'shoot');
  const hasFrequency = await tableHasColumn(db, schema, tableName, 'frequency');
  const hasAvgV = await tableHasColumn(db, schema, tableName, 'avg_v');
  const hasPayload = await tableHasColumn(db, schema, tableName, 'payload');

  const fromTs = options.from ? new Date(options.from) : null;
  const toTs = options.to ? new Date(options.to) : null;
  const fromOk = fromTs && !Number.isNaN(fromTs.getTime()) ? fromTs : null;
  const toOk = toTs && !Number.isNaN(toTs.getTime()) ? toTs : null;

  const whereParts = [];
  const params = [];
  if (fromOk) {
    params.push(toVietnamWallClock(fromOk));
    whereParts.push(`timestamp >= $${params.length}::timestamp`);
  }
  if (toOk) {
    params.push(toVietnamWallClock(toOk));
    whereParts.push(`timestamp <= $${params.length}::timestamp`);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Bảng CNC điện (frequency / avg_v) hoặc legacy (shoot): SELECT cột cần dùng (nhẹ hơn *)
  if (hasLegacyColumns || hasFrequency || hasAvgV) {
    if (!hasFrequency) {
      await ensureCncElectricalTelemetryColumns(db, qualified);
    }
    const slim = options.slim !== false;
    const selectSql = slim
      ? `id, machine_id, timestamp, status, time_on, time_running,
         avg_v, avg_a, power, power_consumption, frequency`
      : '*';
    const { rows } = await db.query(
      `SELECT ${selectSql} FROM ${qualified} ${whereSql} ORDER BY timestamp ASC, id ASC`,
      params,
    );
    return rows;
  }

  if (!hasPayload) {
    return [];
  }

  const { rows } = await db.query(
    `SELECT id, machine_id, timestamp, status, payload
     FROM ${qualified}
     ${whereSql}
     ORDER BY timestamp ASC, id ASC`,
    params,
  );
  return rows.map(normalizePayloadRow);
}

/**
 * Tổng hợp telemetry theo ngày lịch (giờ tường VN) — dùng cho biểu đồ ngày/tuần/tháng/quý/năm.
 * Trả ~1 dòng/ngày thay vì toàn bộ mẫu 10s.
 */
export async function fetchCncDailyTelemetryRows(db, machineId, machine, options = {}) {
  const qualified = telemetryTableRef(machineId, machine);
  const { schema, tableName } = parseQualifiedTable(qualified);

  if (!(await tableExists(db, schema, tableName))) {
    return [];
  }

  await ensureTimestampWithoutTz(db, qualified, schema, tableName);

  const hasTimeOn = await tableHasColumn(db, schema, tableName, 'time_on');
  const hasTimeRunning = await tableHasColumn(db, schema, tableName, 'time_running');
  const hasPower = await tableHasColumn(db, schema, tableName, 'power');
  const hasPowerConsumption = await tableHasColumn(db, schema, tableName, 'power_consumption');
  const hasProduct = await tableHasColumn(db, schema, tableName, 'product');
  const hasInput = await tableHasColumn(db, schema, tableName, 'input_material');
  const hasStatus = await tableHasColumn(db, schema, tableName, 'status');
  const hasPayload = await tableHasColumn(db, schema, tableName, 'payload');

  // Bảng payload-only: gom phía server bằng JS từ cửa sổ (hiếm với CNC điện)
  if (!hasTimeOn && !hasTimeRunning && hasPayload) {
    const raw = await fetchCncTelemetryRows(db, machineId, machine, {
      ...options,
      slim: false,
    });
    return aggregateDailyFromRows(raw);
  }

  if (!hasTimeOn && !hasTimeRunning) {
    return [];
  }

  const fromTs = options.from ? new Date(options.from) : null;
  const toTs = options.to ? new Date(options.to) : null;
  const fromOk = fromTs && !Number.isNaN(fromTs.getTime()) ? fromTs : null;
  const toOk = toTs && !Number.isNaN(toTs.getTime()) ? toTs : null;

  const whereParts = [];
  const params = [];
  if (fromOk) {
    params.push(toVietnamWallClock(fromOk));
    whereParts.push(`timestamp >= $${params.length}::timestamp`);
  }
  if (toOk) {
    params.push(toVietnamWallClock(toOk));
    whereParts.push(`timestamp <= $${params.length}::timestamp`);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  const numCol = (exists, name) => (
    exists ? `COALESCE(${name}, 0)::float8` : '0::float8'
  );
  const statusCol = hasStatus ? 'status' : 'NULL';

  const { rows } = await db.query(
    `
    WITH bounded AS (
      SELECT
        id,
        "timestamp",
        ("timestamp")::date AS day,
        ${numCol(hasTimeOn, 'time_on')} AS time_on,
        ${numCol(hasTimeRunning, 'time_running')} AS time_running,
        ${numCol(hasPower, 'power')} AS power,
        ${numCol(hasPowerConsumption, 'power_consumption')} AS power_consumption,
        ${numCol(hasProduct, 'product')} AS product,
        ${numCol(hasInput, 'input_material')} AS input_material,
        ${statusCol} AS status
      FROM ${qualified}
      ${whereSql}
    ),
    with_lag AS (
      SELECT
        *,
        LAG(time_running) OVER (ORDER BY "timestamp" ASC, id ASC) AS prev_run,
        LAG(power) OVER (ORDER BY "timestamp" ASC, id ASC) AS prev_power,
        LAG("timestamp") OVER (ORDER BY "timestamp" ASC, id ASC) AS prev_ts
      FROM bounded
    ),
    with_energy AS (
      SELECT
        *,
        CASE
          WHEN prev_run IS NOT NULL
            AND time_running > prev_run
            AND (time_running - prev_run) <= GREATEST(
              180::float8,
              2.0 * GREATEST(
                1::float8,
                EXTRACT(EPOCH FROM ("timestamp" - prev_ts))
              )
            )
          THEN ((COALESCE(prev_power, power) + power) / 2.0)
               * ((time_running - prev_run) / 3600.0)
          ELSE 0::float8
        END AS d_kwh
      FROM with_lag
    ),
    day_stats AS (
      SELECT
        day,
        MIN("timestamp") AS min_timestamp,
        MAX("timestamp") AS max_timestamp,
        SUM(d_kwh) AS energy_integral,
        (array_agg(time_on ORDER BY "timestamp" ASC, id ASC))[1] AS first_time_on,
        (array_agg(time_on ORDER BY "timestamp" DESC, id DESC))[1] AS last_time_on,
        (array_agg(time_running ORDER BY "timestamp" ASC, id ASC))[1] AS first_time_running,
        (array_agg(time_running ORDER BY "timestamp" DESC, id DESC))[1] AS last_time_running,
        (array_agg(product ORDER BY "timestamp" ASC, id ASC))[1] AS first_product,
        (array_agg(product ORDER BY "timestamp" DESC, id DESC))[1] AS last_product,
        (array_agg(input_material ORDER BY "timestamp" ASC, id ASC))[1] AS first_input,
        (array_agg(input_material ORDER BY "timestamp" DESC, id DESC))[1] AS last_input,
        (array_agg(power ORDER BY "timestamp" DESC, id DESC))[1] AS power,
        (array_agg(status ORDER BY "timestamp" DESC, id DESC))[1] AS status
      FROM with_energy
      GROUP BY day
    )
    SELECT
      day::text AS date_key,
      min_timestamp,
      max_timestamp AS timestamp,
      CASE
        WHEN last_time_on >= first_time_on THEN last_time_on - first_time_on
        ELSE last_time_on
      END AS time_on,
      CASE
        WHEN last_time_running >= first_time_running THEN last_time_running - first_time_running
        ELSE last_time_running
      END AS time_running,
      -- Chỉ tính từ power × Δtime_running (không dùng cột power_consumption PLC — đơn vị sai/phình)
      CASE
        WHEN energy_integral > 0 THEN energy_integral
        ELSE 0::float8
      END AS power_consumption,
      CASE
        WHEN last_product >= first_product THEN last_product - first_product
        ELSE last_product
      END AS product,
      CASE
        WHEN last_input >= first_input THEN last_input - first_input
        ELSE last_input
      END AS input_material,
      power,
      status
    FROM day_stats
    ORDER BY day ASC
    `,
    params,
  );

  return rows.map((r) => ({
    timestamp: r.timestamp,
    min_timestamp: r.min_timestamp,
    max_timestamp: r.timestamp,
    date_key: r.date_key,
    time_on: Number(r.time_on) || 0,
    time_running: Number(r.time_running) || 0,
    power_consumption: Number(r.power_consumption) || 0,
    product: Number(r.product) || 0,
    input_material: Number(r.input_material) || 0,
    power: Number(r.power) || 0,
    status: r.status != null ? Number(r.status) : null,
  }));
}

/** Fallback gom ngày từ rows thô (payload-only). */
function aggregateDailyFromRows(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [];

  const buckets = new Map();
  for (const item of raw) {
    if (!item?.timestamp) continue;
    const date = String(item.timestamp).slice(0, 10);
    let b = buckets.get(date);
    if (!b) {
      b = { min: item, max: item, samples: [item] };
      buckets.set(date, b);
      continue;
    }
    const t = new Date(item.timestamp).getTime();
    if (t < new Date(b.min.timestamp).getTime()) b.min = item;
    if (t > new Date(b.max.timestamp).getTime()) b.max = item;
    b.samples.push(item);
  }

  const resolveDelta = (minVal, maxVal) => {
    const a = Number(minVal) || 0;
    const b = Number(maxVal) || 0;
    return b >= a ? b - a : b;
  };

  return [...buckets.keys()].sort().map((date) => {
    const { min, max, samples } = buckets.get(date);
    let energy = 0;
    const sorted = [...samples].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      const prevRun = Number(sorted[i - 1].time_running) || 0;
      const currRun = Number(sorted[i].time_running) || 0;
      const dt = currRun - prevRun;
      if (dt <= 0) continue;
      const t0 = new Date(sorted[i - 1].timestamp).getTime();
      const t1 = new Date(sorted[i].timestamp).getTime();
      const wallSec = Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0
        ? (t1 - t0) / 1000
        : 60;
      if (dt > Math.max(180, wallSec * 2)) continue;
      const p0 = Number(sorted[i - 1].power) || 0;
      const p1 = Number(sorted[i].power) || 0;
      energy += ((p0 + p1) / 2) * (dt / 3600);
    }
    return {
      timestamp: max.timestamp,
      min_timestamp: min.timestamp,
      max_timestamp: max.timestamp,
      date_key: date,
      time_on: resolveDelta(min.time_on, max.time_on),
      time_running: resolveDelta(min.time_running, max.time_running),
      // Chỉ từ power × Δtime_running
      power_consumption: energy,
      product: resolveDelta(min.product, max.product),
      input_material: resolveDelta(min.input_material, max.input_material),
      power: Number(max.power) || 0,
      status: max.status != null ? Number(max.status) : null,
    };
  });
}

/**
 * Tóm tắt hiệu suất trên TOÀN BỘ lịch sử (không cắt theo tháng/cửa sổ biểu đồ).
 * Dùng bộ đếm lũy kế mới nhất + mốc thời gian mẫu đầu/cuối.
 */
export async function fetchCncPerformanceSummary(db, machineId, machine) {
  const qualified = telemetryTableRef(machineId, machine);
  const { schema, tableName } = parseQualifiedTable(qualified);

  if (!(await tableExists(db, schema, tableName))) {
    return {
      first_timestamp: null,
      last_timestamp: null,
      time_on: 0,
      time_running: 0,
    };
  }

  await ensureTimestampWithoutTz(db, qualified, schema, tableName);

  const hasTimeOn = await tableHasColumn(db, schema, tableName, 'time_on');
  const hasTimeRunning = await tableHasColumn(db, schema, tableName, 'time_running');
  const hasPayload = await tableHasColumn(db, schema, tableName, 'payload');

  const { rows: boundRows } = await db.query(`
    SELECT
      MIN("timestamp") AS first_ts,
      MAX("timestamp") AS last_ts
    FROM ${qualified}
    WHERE "timestamp" IS NOT NULL
  `);

  let timeOn = 0;
  let timeRunning = 0;

  if (hasTimeOn || hasTimeRunning) {
    const selectParts = ['"timestamp"'];
    if (hasTimeOn) selectParts.push('time_on');
    if (hasTimeRunning) selectParts.push('time_running');
    const { rows } = await db.query(`
      SELECT ${selectParts.join(', ')}
      FROM ${qualified}
      ORDER BY "timestamp" DESC NULLS LAST, id DESC
      LIMIT 1
    `);
    const latest = rows[0] || {};
    timeOn = Number(latest.time_on) || 0;
    timeRunning = Number(latest.time_running) || 0;
  } else if (hasPayload) {
    const { rows } = await db.query(`
      SELECT payload, "timestamp"
      FROM ${qualified}
      ORDER BY "timestamp" DESC NULLS LAST, id DESC
      LIMIT 1
    `);
    const normalized = rows[0] ? normalizePayloadRow(rows[0]) : null;
    timeOn = Number(normalized?.time_on) || 0;
    timeRunning = Number(normalized?.time_running) || 0;
  }

  return {
    first_timestamp: boundRows[0]?.first_ts ?? null,
    last_timestamp: boundRows[0]?.last_ts ?? null,
    time_on: timeOn,
    time_running: timeRunning,
  };
}

export async function fetchCncAlarmRows(db, machineId, machine) {
  const qualified = alarmTableRef(machineId, machine);
  const { schema, tableName } = parseQualifiedTable(qualified);

  if (!(await tableExists(db, schema, tableName))) {
    return [];
  }

  const { rows } = await db.query(
    `SELECT * FROM ${qualified}
     WHERE machine_id = $1
     ORDER BY timestamp DESC, id DESC`,
    [machineId],
  );
  return rows;
}

/**
 * Dọn telemetry CNC theo độ phân giải:
 * - Ngày hiện tại (Asia/Ho_Chi_Minh): giữ ~1 mẫu / 10 giây
 * - Các ngày khác: gộp 1 phút / mẫu; công suất + dòng điện = AVG(~6 mẫu 10s)
 * Các cột khác giữ giá trị bản ghi mới nhất trong phút.
 * @returns {{ deleted: number, keptToday: number, keptPast: number, today: string }}
 */
export async function bootCncTelemetryTable(db, machineId, machine) {
  const qualified = telemetryTableRef(machineId, machine);
  const { schema, tableName } = parseQualifiedTable(qualified);

  if (!(await tableExists(db, schema, tableName))) {
    return { deleted: 0, keptToday: 0, keptPast: 0, today: null };
  }

  const hasTimestamp = await tableHasColumn(db, schema, tableName, 'timestamp');
  if (!hasTimestamp) {
    return { deleted: 0, keptToday: 0, keptPast: 0, today: null };
  }

  const hasId = await tableHasColumn(db, schema, tableName, 'id');
  if (!hasId) {
    return { deleted: 0, keptToday: 0, keptPast: 0, today: null };
  }

  // Cột điện lấy trung bình trong bucket 1 phút
  const avgColumnCandidates = [
    'power',
    'avg_a',
    'phase1_a',
    'phase2_a',
    'phase3_a',
  ];
  const avgColumns = [];
  for (const col of avgColumnCandidates) {
    if (await tableHasColumn(db, schema, tableName, col)) {
      avgColumns.push(col);
    }
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`SET LOCAL TIME ZONE 'Asia/Ho_Chi_Minh'`);

    // Ngày hôm nay theo lịch VN (so sánh ::date — tránh lệch múi giờ)
    const { rows: dayRows } = await client.query(`
      SELECT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Ho_Chi_Minh')::date AS today
    `);
    const today = dayRows[0]?.today;

    await client.query(`
      CREATE TEMP TABLE _mida_boot_keep (
        id bigint PRIMARY KEY,
        kind text NOT NULL
      ) ON COMMIT DROP
    `);

    // Hôm nay: 10 giây / mẫu
    await client.query(
      `
      INSERT INTO _mida_boot_keep (id, kind)
      SELECT DISTINCT ON (bucket) id, 'today'
      FROM (
        SELECT
          id,
          floor(extract(epoch FROM "timestamp") / 10)::bigint AS bucket,
          "timestamp"
        FROM ${qualified}
        WHERE "timestamp" IS NOT NULL
          AND ("timestamp")::date = $1::date
      ) AS src
      ORDER BY bucket, "timestamp" DESC, id DESC
      `,
      [today],
    );

    // Các ngày khác: 1 phút / mẫu + AVG công suất/dòng
    if (avgColumns.length > 0) {
      const avgSelects = avgColumns
        .map((col) => `AVG("${col}")::float8 AS avg_${col}`)
        .join(',\n          ');
      const avgColDefs = avgColumns
        .map((col) => `avg_${col} float8`)
        .join(',\n        ');
      const updateSets = avgColumns
        .map((col) => `"${col}" = a.avg_${col}`)
        .join(',\n        ');

      await client.query(`
        CREATE TEMP TABLE _mida_boot_min_agg (
          keep_id bigint PRIMARY KEY,
          ${avgColDefs}
        ) ON COMMIT DROP
      `);

      await client.query(
        `
        INSERT INTO _mida_boot_min_agg (keep_id, ${avgColumns.map((c) => `avg_${c}`).join(', ')})
        SELECT
          (array_agg(id ORDER BY "timestamp" DESC, id DESC))[1] AS keep_id,
          ${avgSelects}
        FROM ${qualified}
        WHERE "timestamp" IS NOT NULL
          AND ("timestamp")::date < $1::date
        GROUP BY floor(extract(epoch FROM "timestamp") / 60)::bigint
        `,
        [today],
      );

      await client.query(`
        UPDATE ${qualified} AS t
        SET
          ${updateSets}
        FROM _mida_boot_min_agg AS a
        WHERE t.id = a.keep_id
      `);

      await client.query(`
        INSERT INTO _mida_boot_keep (id, kind)
        SELECT keep_id, 'past' FROM _mida_boot_min_agg
        ON CONFLICT (id) DO NOTHING
      `);
    } else {
      await client.query(
        `
        INSERT INTO _mida_boot_keep (id, kind)
        SELECT DISTINCT ON (bucket) id, 'past'
        FROM (
          SELECT
            id,
            floor(extract(epoch FROM "timestamp") / 60)::bigint AS bucket,
            "timestamp"
          FROM ${qualified}
          WHERE "timestamp" IS NOT NULL
            AND ("timestamp")::date < $1::date
        ) AS src
        ORDER BY bucket, "timestamp" DESC, id DESC
        ON CONFLICT (id) DO NOTHING
        `,
        [today],
      );
    }

    const { rows: keepStats } = await client.query(`
      SELECT
        COUNT(*) FILTER (WHERE kind = 'today')::int AS kept_today,
        COUNT(*) FILTER (WHERE kind = 'past')::int AS kept_past
      FROM _mida_boot_keep
    `);

    const result = await client.query(`
      DELETE FROM ${qualified} AS t
      WHERE NOT EXISTS (
        SELECT 1 FROM _mida_boot_keep AS k WHERE k.id = t.id
      )
    `);

    await client.query('COMMIT');
    return {
      deleted: result.rowCount ?? 0,
      keptToday: keepStats[0]?.kept_today ?? 0,
      keptPast: keepStats[0]?.kept_past ?? 0,
      today: today != null ? String(today).slice(0, 10) : null,
    };
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}
