import pool from '../db.js';

const MACHINE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/** Path backend trên máy sort → chuyển sang api_port thay vì port frontend. */
export const DTR_API_PATH_PREFIXES = ['/stats', '/api', '/uploads', '/ws'];

export async function ensureDtrSortMachinesTable(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS dtr_sort_machines (
      machine_id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      tailscale_ip VARCHAR(45) NOT NULL,
      port INT NOT NULL DEFAULT 5173,
      api_port INT,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT dtr_sort_machines_port_chk CHECK (port >= 1 AND port <= 65535)
    );
  `);
  await db.query(`
    ALTER TABLE dtr_sort_machines
      ADD COLUMN IF NOT EXISTS api_port INT;
  `);
  await db.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'dtr_sort_machines_api_port_chk'
      ) THEN
        ALTER TABLE dtr_sort_machines
          ADD CONSTRAINT dtr_sort_machines_api_port_chk
          CHECK (api_port IS NULL OR (api_port >= 1 AND api_port <= 65535));
      END IF;
    END $$;
  `);
}

function isValidIpv4(ip) {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split('.').every((part) => {
    const n = Number(part);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

function parseOptionalPort(raw, { required = false, fallback = null } = {}) {
  if (raw === undefined || raw === null || raw === '') {
    if (required) return { error: 'port bắt buộc' };
    return { value: fallback };
  }
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'port phải là số nguyên 1–65535' };
  }
  return { value: port };
}

export function normalizeDtrMachineInput(body = {}) {
  const machineId = String(body.machine_id ?? body.machineId ?? '').trim();
  const name = String(body.name ?? '').trim();
  const tailscaleIp = String(body.tailscale_ip ?? body.tailscaleIp ?? '').trim();
  const portParsed = parseOptionalPort(body.port ?? 5173, { required: true });
  const apiPortParsed = parseOptionalPort(body.api_port ?? body.apiPort, { fallback: null });
  const note = body.note == null ? null : String(body.note).trim() || null;

  if (!MACHINE_ID_RE.test(machineId)) {
    return { error: 'machine_id không hợp lệ (chữ/số/_/-, tối đa 64 ký tự)' };
  }
  if (!isValidIpv4(tailscaleIp)) {
    return { error: 'tailscale_ip phải là IPv4 hợp lệ (vd. 100.70.140.122)' };
  }
  if (portParsed.error) return { error: portParsed.error };
  if (apiPortParsed.error) return { error: `api_port: ${apiPortParsed.error}` };

  return {
    machine_id: machineId,
    name: name || machineId,
    tailscale_ip: tailscaleIp,
    port: portParsed.value,
    api_port: apiPortParsed.value,
    note,
  };
}

export function isDtrApiPath(restPath = '/') {
  const path = restPath.startsWith('/') ? restPath : `/${restPath}`;
  return DTR_API_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export async function listDtrSortMachines() {
  const { rows } = await pool.query(
    `SELECT machine_id, name, tailscale_ip, port, api_port, note, created_at, updated_at
     FROM dtr_sort_machines
     ORDER BY created_at DESC, machine_id ASC`,
  );
  return rows;
}

export async function getDtrSortMachineById(machineId) {
  const { rows } = await pool.query(
    `SELECT machine_id, name, tailscale_ip, port, api_port, note, created_at, updated_at
     FROM dtr_sort_machines
     WHERE machine_id = $1`,
    [machineId],
  );
  return rows[0] || null;
}

export async function insertDtrSortMachine(data) {
  const { rows } = await pool.query(
    `INSERT INTO dtr_sort_machines (machine_id, name, tailscale_ip, port, api_port, note)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING machine_id, name, tailscale_ip, port, api_port, note, created_at, updated_at`,
    [data.machine_id, data.name, data.tailscale_ip, data.port, data.api_port, data.note],
  );
  return rows[0];
}

export async function deleteDtrSortMachine(machineId) {
  const { rows } = await pool.query(
    `DELETE FROM dtr_sort_machines WHERE machine_id = $1
     RETURNING machine_id`,
    [machineId],
  );
  return rows[0] || null;
}
