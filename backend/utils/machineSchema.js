/** PostgreSQL schema cho bảng dữ liệu theo loại máy (hiển thị như "thư mục" trong pgAdmin). */
export const SCHEMA = {
  PUBLIC: 'public',
  CNC: 'cnc',
};

export function qualifyTable(schema, tableName) {
  const id = String(tableName).trim();
  return `"${schema}"."${id}"`;
}

export const PUBLIC_MACHINES_TABLE = qualifyTable(SCHEMA.PUBLIC, 'machines');
export const CNC_MACHINES_TABLE = qualifyTable(SCHEMA.CNC, 'machines');

export function midaMachinesTableRef() {
  return CNC_MACHINES_TABLE;
}

export function isCncMachine(machineOrCategory) {
  if (typeof machineOrCategory === 'string') {
    return machineOrCategory === 'cnc';
  }
  return machineOrCategory?.machine_category === 'cnc';
}

export function isMidaPortalMachine(machineOrCategory) {
  const category = typeof machineOrCategory === 'string'
    ? machineOrCategory
    : machineOrCategory?.machine_category;
  return category === 'cnc' || category === 'ep';
}

export function resolveDataSchema(machineOrCategory) {
  return isMidaPortalMachine(machineOrCategory) ? SCHEMA.CNC : SCHEMA.PUBLIC;
}

export function telemetryTableRef(machineId, machineOrCategory) {
  const schema = resolveDataSchema(machineOrCategory);
  return qualifyTable(schema, machineId);
}

export function alarmTableRef(machineId, machineOrCategory) {
  const schema = resolveDataSchema(machineOrCategory);
  return qualifyTable(schema, `alarm${String(machineId).trim()}`);
}

export async function ensureCncSchema(db) {
  await db.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA.CNC}`);
}

export async function ensureCncMachinesTable(db) {
  await ensureCncSchema(db);
  await db.query(`
    CREATE TABLE IF NOT EXISTS cnc.machines (
      machine_id TEXT PRIMARY KEY,
      machine_name VARCHAR(255),
      location VARCHAR(255),
      image_url TEXT,
      isdtgroup BOOLEAN,
      status INT,
      last_updated TIMESTAMPTZ,
      information TEXT,
      output_name VARCHAR(255),
      output_unit VARCHAR(64),
      input_name VARCHAR(255),
      input_unit VARCHAR(64),
      machine_category VARCHAR(32) DEFAULT 'cnc'
    );
  `);
  await db.query(`ALTER TABLE ${CNC_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS layout_x REAL`);
  await db.query(`ALTER TABLE ${CNC_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS layout_y REAL`);
}

/** Kiểm tra machine_id đã tồn tại ở public hoặc cnc.machines */
export async function machineIdExists(db, machineId) {
  const id = String(machineId).trim();
  const [inPublic, inCnc] = await Promise.all([
    db.query(`SELECT 1 FROM ${PUBLIC_MACHINES_TABLE} WHERE machine_id = $1`, [id]),
    db.query(`SELECT 1 FROM ${CNC_MACHINES_TABLE} WHERE machine_id = $1`, [id]),
  ]);
  return inPublic.rowCount > 0 || inCnc.rowCount > 0;
}

/** Tìm bảng registry chứa máy (public.machines hoặc cnc.machines) */
export async function findMachinesRegistryTable(db, machineId) {
  const id = String(machineId).trim();
  const inPublic = await db.query(
    `SELECT machine_category FROM ${PUBLIC_MACHINES_TABLE} WHERE machine_id = $1`,
    [id],
  );
  if (inPublic.rowCount > 0) {
    return { table: PUBLIC_MACHINES_TABLE, machine: inPublic.rows[0] };
  }
  const inCnc = await db.query(
    `SELECT machine_category FROM ${CNC_MACHINES_TABLE} WHERE machine_id = $1`,
    [id],
  );
  if (inCnc.rowCount > 0) {
    return { table: CNC_MACHINES_TABLE, machine: inCnc.rows[0] };
  }
  return null;
}
