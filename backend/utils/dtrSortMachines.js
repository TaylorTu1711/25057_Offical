import pool from '../db.js';
import { DTR_MACHINES_TABLE, ensureDtrMachinesTable } from './machineSchema.js';
import {
  dropDtrMachineDataTables,
  ensureDtrMachineDataTables,
} from './dtrTelemetry.js';

const MACHINE_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
const IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

/** Path backend trên máy sort → chuyển sang api_port thay vì port frontend. */
export const DTR_API_PATH_PREFIXES = ['/stats', '/api', '/uploads', '/ws', '/socket.io'];

const DTR_MACHINE_SELECT = `
  machine_id, name, machine_name, location, image_url, isdtgroup,
  output_name, output_unit, input_name, input_unit,
  tailscale_ip, port, api_port, note, bottle_glossary, handover_date,
  status, last_updated, created_at, updated_at
`;

const DATE_ONLY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseOptionalDate(raw) {
  if (raw === undefined) return { value: undefined };
  if (raw === null || raw === '') return { value: null };
  const s = String(raw).trim().slice(0, 10);
  if (!DATE_ONLY_RE.test(s)) {
    return { error: 'Ngày bàn giao phải dạng YYYY-MM-DD' };
  }
  const d = new Date(`${s}T00:00:00`);
  if (Number.isNaN(d.getTime())) {
    return { error: 'Ngày bàn giao không hợp lệ' };
  }
  return { value: s };
}

/** Key ký hiệu loại chai được phép lưu (map key → meaning). */
const BOTTLE_GLOSSARY_KEYS = [
  'b1_kn', 'b1_nl', 'b1_nn', 'b1_oh',
  'b4_kn', 'b4_nl', 'b4_nn', 'b4_oh',
  'b5_kn', 'b5_nl', 'b5_nn',
  'hu_kn', 'hu_nl',
  'no_classify',
];

function parseBottleGlossary(raw) {
  if (raw == null || raw === '') return null;
  let src = raw;
  if (typeof raw === 'string') {
    try {
      src = JSON.parse(raw);
    } catch {
      return { error: 'bottle_glossary phải là JSON hợp lệ' };
    }
  }
  if (!src || typeof src !== 'object' || Array.isArray(src)) {
    return { error: 'bottle_glossary phải là object { key: meaning }' };
  }
  const out = {};
  for (const key of BOTTLE_GLOSSARY_KEYS) {
    const value = src[key] ?? src[String(key).toUpperCase()];
    if (value == null) continue;
    const meaning = String(value).trim();
    if (!meaning) continue;
    if (meaning.length > 200) {
      return { error: `bottle_glossary.${key} quá dài (tối đa 200 ký tự)` };
    }
    out[key] = meaning;
  }
  return { value: Object.keys(out).length > 0 ? out : null };
}

/** @deprecated dùng ensureDtrMachinesTable — giữ alias để script/migrate cũ không gãy. */
export async function ensureDtrSortMachinesTable(db = pool) {
  await ensureDtrMachinesTable(db);
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

/**
 * Chuẩn hóa body thêm máy Sort — gồm trường Plenma SCADA + Tailscale/proxy.
 * @param {object} body
 * @param {{ imagePath?: string|null }} [opts]
 */
export function normalizeDtrMachineInput(body = {}, opts = {}) {
  const machineId = String(body.machine_id ?? body.machineId ?? '').trim();
  const machineName = String(
    body.machine_name ?? body.machineName ?? body.name ?? '',
  ).trim();
  const location = String(body.location ?? '').trim();
  const tailscaleIp = String(body.tailscale_ip ?? body.tailscaleIp ?? '').trim();
  const portParsed = parseOptionalPort(body.port ?? 5173, { required: true });
  const apiPortParsed = parseOptionalPort(body.api_port ?? body.apiPort, { fallback: null });
  const note = body.note == null ? null : String(body.note).trim() || null;
  const imageUrl = opts.imagePath != null
    ? opts.imagePath
    : (body.image_url != null ? String(body.image_url).trim() || null : null);
  const glossaryParsed = Object.prototype.hasOwnProperty.call(body, 'bottle_glossary')
    ? parseBottleGlossary(body.bottle_glossary)
    : { value: undefined };
  const handoverParsed = Object.prototype.hasOwnProperty.call(body, 'handover_date')
    || Object.prototype.hasOwnProperty.call(body, 'handoverDate')
    ? parseOptionalDate(body.handover_date ?? body.handoverDate)
    : { value: undefined };

  if (!MACHINE_ID_RE.test(machineId)) {
    return { error: 'machine_id không hợp lệ (chữ/số/_/-, tối đa 64 ký tự)' };
  }
  if (!machineName) {
    return { error: 'Thiếu tên máy' };
  }
  if (!location) {
    return { error: 'Thiếu nhà máy (location)' };
  }
  if (!isValidIpv4(tailscaleIp)) {
    return { error: 'tailscale_ip phải là IPv4 hợp lệ (vd. 100.70.140.122)' };
  }
  if (portParsed.error) return { error: portParsed.error };
  if (apiPortParsed.error) return { error: `api_port: ${apiPortParsed.error}` };
  if (glossaryParsed.error) return { error: glossaryParsed.error };
  if (handoverParsed.error) return { error: handoverParsed.error };

  return {
    machine_id: machineId,
    name: machineName,
    machine_name: machineName,
    location,
    image_url: imageUrl,
    isdtgroup: false,
    output_name: null,
    output_unit: null,
    input_name: null,
    input_unit: null,
    tailscale_ip: tailscaleIp,
    port: portParsed.value,
    api_port: apiPortParsed.value,
    note,
    bottle_glossary: glossaryParsed.value,
    handover_date: handoverParsed.value,
  };
}

export function isDtrApiPath(restPath = '/') {
  const path = restPath.startsWith('/') ? restPath : `/${restPath}`;
  return DTR_API_PATH_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

export async function listDtrSortMachines() {
  await ensureDtrMachinesTable(pool);
  const { rows } = await pool.query(
    `SELECT ${DTR_MACHINE_SELECT}
     FROM ${DTR_MACHINES_TABLE}
     ORDER BY created_at DESC, machine_id ASC`,
  );
  return rows;
}

export async function getDtrSortMachineById(machineId) {
  await ensureDtrMachinesTable(pool);
  const { rows } = await pool.query(
    `SELECT ${DTR_MACHINE_SELECT}
     FROM ${DTR_MACHINES_TABLE}
     WHERE machine_id = $1`,
    [machineId],
  );
  return rows[0] || null;
}

export async function insertDtrSortMachine(data) {
  await ensureDtrMachinesTable(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO ${DTR_MACHINES_TABLE} (
         machine_id, name, machine_name, location, image_url, isdtgroup,
         output_name, output_unit, input_name, input_unit,
         tailscale_ip, port, api_port, note, bottle_glossary, handover_date
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb, $16::date)
       RETURNING ${DTR_MACHINE_SELECT}`,
      [
        data.machine_id,
        data.name,
        data.machine_name,
        data.location,
        data.image_url,
        data.isdtgroup,
        data.output_name,
        data.output_unit,
        data.input_name,
        data.input_unit,
        data.tailscale_ip,
        data.port,
        data.api_port,
        data.note,
        data.bottle_glossary != null ? JSON.stringify(data.bottle_glossary) : null,
        data.handover_date ?? null,
      ],
    );
    await ensureDtrMachineDataTables(client, data.machine_id);
    await client.query('COMMIT');
    return rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Cập nhật thông tin máy (không đổi machine_id).
 * image_url: null/undefined → giữ ảnh cũ.
 */
export async function updateDtrSortMachine(machineId, data) {
  await ensureDtrMachinesTable(pool);
  const { rows } = await pool.query(
    `UPDATE ${DTR_MACHINES_TABLE}
     SET name = $2,
         machine_name = $3,
         location = $4,
         image_url = COALESCE($5, image_url),
         tailscale_ip = $6,
         port = $7,
         api_port = $8,
         note = $9,
         bottle_glossary = CASE
           WHEN $10::text IS NULL THEN bottle_glossary
           ELSE $10::jsonb
         END,
         handover_date = CASE
           WHEN $11::text IS NULL THEN handover_date
           WHEN $11::text = '' THEN NULL
           ELSE $11::date
         END,
         updated_at = NOW()
     WHERE machine_id = $1
     RETURNING ${DTR_MACHINE_SELECT}`,
    [
      machineId,
      data.name,
      data.machine_name,
      data.location,
      data.image_url ?? null,
      data.tailscale_ip,
      data.port,
      data.api_port,
      data.note,
      data.bottle_glossary !== undefined
        ? JSON.stringify(data.bottle_glossary)
        : null,
      data.handover_date !== undefined
        ? (data.handover_date ?? '')
        : null,
    ],
  );
  return rows[0] || null;
}

export async function deleteDtrSortMachine(machineId) {
  await ensureDtrMachinesTable(pool);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `DELETE FROM ${DTR_MACHINES_TABLE} WHERE machine_id = $1
       RETURNING machine_id`,
      [machineId],
    );
    if (rows[0]) {
      await dropDtrMachineDataTables(client, machineId);
    }
    await client.query('COMMIT');
    return rows[0] || null;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
