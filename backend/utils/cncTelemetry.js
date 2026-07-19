import { SCHEMA, alarmTableRef, telemetryTableRef } from './machineSchema.js';

function parseQualifiedTable(qualified) {
  const match = String(qualified).match(/^"([^"]+)"\."([^"]+)"$/);
  if (!match) {
    throw new Error(`Invalid qualified table: ${qualified}`);
  }
  return { schema: match[1], tableName: match[2] };
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
  ['timestamp', 'TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP'],
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

export async function fetchCncTelemetryRows(db, machineId, machine) {
  const qualified = telemetryTableRef(machineId, machine);
  const { schema, tableName } = parseQualifiedTable(qualified);

  if (!(await tableExists(db, schema, tableName))) {
    return [];
  }

  const hasLegacyColumns = await tableHasColumn(db, schema, tableName, 'shoot');
  const hasFrequency = await tableHasColumn(db, schema, tableName, 'frequency');
  const hasAvgV = await tableHasColumn(db, schema, tableName, 'avg_v');
  const hasPayload = await tableHasColumn(db, schema, tableName, 'payload');

  // Bảng CNC điện (frequency / avg_v) hoặc legacy (shoot): đọc flat SELECT *
  if (hasLegacyColumns || hasFrequency || hasAvgV) {
    if (!hasFrequency) {
      await ensureCncElectricalTelemetryColumns(db, qualified);
    }
    const { rows } = await db.query(
      `SELECT * FROM ${qualified} ORDER BY timestamp ASC, id ASC`,
    );
    return rows;
  }

  if (!hasPayload) {
    return [];
  }

  const { rows } = await db.query(
    `SELECT id, machine_id, timestamp, status, payload
     FROM ${qualified}
     ORDER BY timestamp ASC, id ASC`,
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

  const result = await db.query(`
    DELETE FROM ${qualified} AS t
    USING (
      SELECT
        DATE("timestamp") AS date_day,
        MIN("timestamp") AS min_time,
        MAX("timestamp") AS max_time
      FROM ${qualified}
      WHERE DATE("timestamp") <> CURRENT_DATE
      GROUP BY DATE("timestamp")
    ) AS keep
    WHERE DATE(t."timestamp") = keep.date_day
      AND t."timestamp" NOT IN (keep.min_time, keep.max_time)
  `);

  return result.rowCount;
}
