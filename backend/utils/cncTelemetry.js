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
    params.push(fromOk.toISOString().slice(0, 19).replace('T', ' '));
    whereParts.push(`timestamp >= $${params.length}::timestamp`);
  }
  if (toOk) {
    params.push(toOk.toISOString().slice(0, 19).replace('T', ' '));
    whereParts.push(`timestamp <= $${params.length}::timestamp`);
  }
  const whereSql = whereParts.length ? `WHERE ${whereParts.join(' AND ')}` : '';

  // Bảng CNC điện (frequency / avg_v) hoặc legacy (shoot): đọc flat SELECT *
  if (hasLegacyColumns || hasFrequency || hasAvgV) {
    if (!hasFrequency) {
      await ensureCncElectricalTelemetryColumns(db, qualified);
    }
    const { rows } = await db.query(
      `SELECT * FROM ${qualified} ${whereSql} ORDER BY timestamp ASC, id ASC`,
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
 * Dọn telemetry CNC theo 2 mức:
 * - Các ngày trước hôm nay: giữ ~1 mẫu / 5 phút
 * - Hôm nay: giữ ~1 mẫu / 10 giây
 * Mỗi bucket giữ bản ghi mới nhất.
 * Dùng temp keep-ids + anti-join (tránh DELETE NOT IN gây chậm/502 trên bảng lớn).
 * @returns {number} số dòng đã xóa
 */
export async function bootCncTelemetryTable(db, machineId, machine) {
  const qualified = telemetryTableRef(machineId, machine);
  const { schema, tableName } = parseQualifiedTable(qualified);

  if (!(await tableExists(db, schema, tableName))) {
    return 0;
  }

  const hasTimestamp = await tableHasColumn(db, schema, tableName, 'timestamp');
  if (!hasTimestamp) {
    return 0;
  }

  const hasId = await tableHasColumn(db, schema, tableName, 'id');
  if (!hasId) {
    return 0;
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      CREATE TEMP TABLE _mida_boot_keep (
        id bigint PRIMARY KEY
      ) ON COMMIT DROP
    `);

    // Past days: 5 phút (300s); today: 10 giây
    await client.query(`
      INSERT INTO _mida_boot_keep (id)
      SELECT DISTINCT ON (day_part, bucket) id
      FROM (
        SELECT
          id,
          CASE
            WHEN DATE("timestamp") = CURRENT_DATE THEN 1
            ELSE 0
          END AS day_part,
          CASE
            WHEN DATE("timestamp") = CURRENT_DATE
              THEN floor(extract(epoch FROM "timestamp") / 10)::bigint
            ELSE floor(extract(epoch FROM "timestamp") / 300)::bigint
          END AS bucket,
          "timestamp"
        FROM ${qualified}
        WHERE "timestamp" IS NOT NULL
      ) AS src
      ORDER BY day_part, bucket, "timestamp" DESC, id DESC
    `);

    const result = await client.query(`
      DELETE FROM ${qualified} AS t
      WHERE NOT EXISTS (
        SELECT 1 FROM _mida_boot_keep AS k WHERE k.id = t.id
      )
    `);

    await client.query('COMMIT');
    return result.rowCount ?? 0;
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
