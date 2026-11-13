/** PostgreSQL schema cho bảng dữ liệu theo loại máy (hiển thị như "thư mục" trong pgAdmin). */
export const SCHEMA = {
  PUBLIC: 'public',
  CNC: 'cnc',
  DTR: 'dtr',
};

export function qualifyTable(schema, tableName) {
  const id = String(tableName).trim();
  return `"${schema}"."${id}"`;
}

export const PUBLIC_MACHINES_TABLE = qualifyTable(SCHEMA.PUBLIC, 'machines');
export const CNC_MACHINES_TABLE = qualifyTable(SCHEMA.CNC, 'machines');
export const DTR_MACHINES_TABLE = qualifyTable(SCHEMA.DTR, 'machines');

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

export async function ensureDtrSchema(db) {
  await db.query(`CREATE SCHEMA IF NOT EXISTS ${SCHEMA.DTR}`);
}

/**
 * Registry máy DTR Sort — tương tự cnc.machines.
 * Cột Tailscale/proxy riêng; telemetry từng máy sẽ nằm trong schema dtr (dtr."<id>").
 */
export async function ensureDtrMachinesTable(db) {
  await ensureDtrSchema(db);
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${DTR_MACHINES_TABLE} (
      machine_id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      tailscale_ip VARCHAR(45) NOT NULL,
      port INT NOT NULL DEFAULT 5173,
      api_port INT,
      note TEXT,
      status INT,
      last_updated TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT dtr_machines_port_chk CHECK (port >= 1 AND port <= 65535),
      CONSTRAINT dtr_machines_api_port_chk CHECK (
        api_port IS NULL OR (api_port >= 1 AND api_port <= 65535)
      )
    )
  `);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS api_port INT`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS note TEXT`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS status INT`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS last_updated TIMESTAMPTZ`);
  await db.query(
    `ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  );
  await db.query(
    `ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`,
  );
  // Cột giống máy Plenma SCADA (form thêm máy)
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS machine_name VARCHAR(255)`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS location VARCHAR(255)`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS isdtgroup BOOLEAN DEFAULT false`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS output_name VARCHAR(255)`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS output_unit VARCHAR(64)`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS input_name VARCHAR(255)`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS input_unit VARCHAR(64)`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS bottle_glossary JSONB`);
  await db.query(`ALTER TABLE ${DTR_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS handover_date DATE`);
  // Đồng bộ name ↔ machine_name cho máy cũ
  await db.query(`
    UPDATE ${DTR_MACHINES_TABLE}
    SET machine_name = name
    WHERE (machine_name IS NULL OR machine_name = '')
      AND name IS NOT NULL AND name <> ''
  `);
  await db.query(`
    UPDATE ${DTR_MACHINES_TABLE}
    SET name = machine_name
    WHERE (name IS NULL OR name = '')
      AND machine_name IS NOT NULL AND machine_name <> ''
  `);

  // Dọn bảng cũ nếu còn sót
  await db.query(`DROP TABLE IF EXISTS public.dtr_sort_machines`);
}

/** Cột registry máy — ALTER IF NOT EXISTS vì CREATE TABLE không bổ sung bảng cũ. */
async function ensureMachinesRegistryColumns(db, tableRef, categoryDefault) {
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS machine_name VARCHAR(255)`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS location VARCHAR(255)`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS image_url TEXT`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS isdtgroup BOOLEAN`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS status INT`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS last_updated TIMESTAMP`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS information TEXT`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS output_name VARCHAR(255)`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS output_unit VARCHAR(64)`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS input_name VARCHAR(255)`);
  await db.query(`ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS input_unit VARCHAR(64)`);
  await db.query(
    `ALTER TABLE ${tableRef} ADD COLUMN IF NOT EXISTS machine_category VARCHAR(32) DEFAULT '${categoryDefault}'`,
  );
}

export async function ensurePublicMachinesTable(db) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS ${PUBLIC_MACHINES_TABLE} (
      machine_id TEXT PRIMARY KEY,
      machine_name VARCHAR(255),
      location VARCHAR(255),
      image_url TEXT,
      isdtgroup BOOLEAN,
      status INT,
      last_updated TIMESTAMP,
      information TEXT,
      output_name VARCHAR(255),
      output_unit VARCHAR(64),
      input_name VARCHAR(255),
      input_unit VARCHAR(64),
      machine_category VARCHAR(32) DEFAULT 'standard'
    )
  `);
  await ensureMachinesRegistryColumns(db, PUBLIC_MACHINES_TABLE, 'standard');
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
  await ensureMachinesRegistryColumns(db, CNC_MACHINES_TABLE, 'cnc');
  await db.query(`ALTER TABLE ${CNC_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS layout_x REAL`);
  await db.query(`ALTER TABLE ${CNC_MACHINES_TABLE} ADD COLUMN IF NOT EXISTS layout_y REAL`);
}

/**
 * Tìm chỗ machine_id đã dùng (tránh trùng giữa public / cnc / dtr).
 * @returns {{ schema: 'public'|'cnc'|'dtr', label: string } | null}
 */
export async function findMachineIdConflict(db, machineId) {
  const id = String(machineId).trim();
  if (!id) return null;

  const [inPublic, inCnc, inDtr] = await Promise.all([
    db.query(`SELECT 1 FROM ${PUBLIC_MACHINES_TABLE} WHERE machine_id = $1`, [id]),
    db.query(`SELECT 1 FROM ${CNC_MACHINES_TABLE} WHERE machine_id = $1`, [id]),
    db.query(`SELECT 1 FROM ${DTR_MACHINES_TABLE} WHERE machine_id = $1`, [id]),
  ]);

  if (inPublic.rowCount > 0) {
    return { schema: SCHEMA.PUBLIC, label: 'Plenma (public.machines)' };
  }
  if (inCnc.rowCount > 0) {
    return { schema: SCHEMA.CNC, label: 'Mida CNC (cnc.machines)' };
  }
  if (inDtr.rowCount > 0) {
    return { schema: SCHEMA.DTR, label: 'DTR Sort (dtr.machines)' };
  }
  return null;
}

/** Kiểm tra machine_id đã tồn tại ở public / cnc / dtr.machines */
export async function machineIdExists(db, machineId) {
  return (await findMachineIdConflict(db, machineId)) != null;
}

export function machineIdConflictMessage(machineId, conflict) {
  const id = String(machineId || '').trim();
  if (!conflict) {
    return `ID máy "${id}" đã tồn tại. Vui lòng dùng ID khác.`;
  }
  return `ID máy "${id}" đã tồn tại ở ${conflict.label}. Vui lòng dùng ID khác.`;
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
