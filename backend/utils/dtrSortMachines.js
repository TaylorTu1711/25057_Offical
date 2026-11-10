import pool from '../db.js';

const MACHINE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export async function ensureDtrSortMachinesTable(db = pool) {
  await db.query(`
    CREATE TABLE IF NOT EXISTS dtr_sort_machines (
      machine_id VARCHAR(64) PRIMARY KEY,
      name VARCHAR(255) NOT NULL DEFAULT '',
      tailscale_ip VARCHAR(45) NOT NULL,
      port INT NOT NULL DEFAULT 5173,
      note TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT dtr_sort_machines_port_chk CHECK (port >= 1 AND port <= 65535)
    );
  `);
}

function isValidIpv4(ip) {
  if (!IPV4_RE.test(ip)) return false;
  return ip.split('.').every((part) => {
    const n = Number(part);
    return Number.isInteger(n) && n >= 0 && n <= 255;
  });
}

export function normalizeDtrMachineInput(body = {}) {
  const machineId = String(body.machine_id ?? body.machineId ?? '').trim();
  const name = String(body.name ?? '').trim();
  const tailscaleIp = String(body.tailscale_ip ?? body.tailscaleIp ?? '').trim();
  const portRaw = body.port ?? 5173;
  const port = Number(portRaw);
  const note = body.note == null ? null : String(body.note).trim() || null;

  if (!MACHINE_ID_RE.test(machineId)) {
    return { error: 'machine_id không hợp lệ (chữ/số/_/-, tối đa 64 ký tự)' };
  }
  if (!isValidIpv4(tailscaleIp)) {
    return { error: 'tailscale_ip phải là IPv4 hợp lệ (vd. 100.70.140.122)' };
  }
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    return { error: 'port phải là số nguyên 1–65535' };
  }

  return {
    machine_id: machineId,
    name: name || machineId,
    tailscale_ip: tailscaleIp,
    port,
    note,
  };
}

export async function listDtrSortMachines() {
  const { rows } = await pool.query(
    `SELECT machine_id, name, tailscale_ip, port, note, created_at, updated_at
     FROM dtr_sort_machines
     ORDER BY created_at DESC, machine_id ASC`,
  );
  return rows;
}

export async function getDtrSortMachineById(machineId) {
  const { rows } = await pool.query(
    `SELECT machine_id, name, tailscale_ip, port, note, created_at, updated_at
     FROM dtr_sort_machines
     WHERE machine_id = $1`,
    [machineId],
  );
  return rows[0] || null;
}

export async function insertDtrSortMachine(data) {
  const { rows } = await pool.query(
    `INSERT INTO dtr_sort_machines (machine_id, name, tailscale_ip, port, note)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING machine_id, name, tailscale_ip, port, note, created_at, updated_at`,
    [data.machine_id, data.name, data.tailscale_ip, data.port, data.note],
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
