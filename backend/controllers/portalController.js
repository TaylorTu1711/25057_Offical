import pool from '../db.js';
import { getUserAllowedLocations, PORTALS } from '../utils/userScope.js';
import { alarmTableRef, ensureCncMachinesTable, ensureCncSchema, machineIdExists, midaMachinesTableRef, telemetryTableRef } from '../utils/machineSchema.js';
import {
  bootCncTelemetryTable,
  ensureCncElectricalTelemetryColumns,
  fetchCncAlarmRows,
  fetchCncTelemetryRows,
} from '../utils/cncTelemetry.js';

const MIDA_MACHINES = midaMachinesTableRef();

const CNC_MACHINE_FILTER = `(
  machine_category = 'cnc'
  OR machine_name ILIKE '%CNC%'
  OR machine_id ILIKE '%cnc%'
)`;

const EP_MACHINE_FILTER = `(
  machine_category = 'ep'
  OR machine_name ILIKE '%ép%'
  OR machine_name ILIKE '%EP%'
  OR machine_id ILIKE '%_ep_%'
  OR machine_id ILIKE '%ep%'
)`;

const MIDA_PORTAL_MACHINE_FILTER = `(
  ${CNC_MACHINE_FILTER.replace(/^\(\s*|\s*\)$/g, '')}
  OR ${EP_MACHINE_FILTER.replace(/^\(\s*|\s*\)$/g, '')}
)`;

function getMachineTypeFilter(type) {
  return type === 'ep' ? EP_MACHINE_FILTER : CNC_MACHINE_FILTER;
}

function normalizeMachineType(type) {
  return type === 'ep' ? 'ep' : 'cnc';
}

async function resolveCncScope(userId, role) {
  const locations = await getUserAllowedLocations(userId, role);
  if (role !== 'admin' && (!locations || locations.length === 0)) {
    return { error: 'User chưa được gán nhà máy', status: 403 };
  }
  return { locations };
}

async function findAuthorizedMidaMachine(machine_id, locations) {
  let query = `
    SELECT machine_id, machine_name, location, image_url, status, last_updated,
           information, output_name, output_unit, input_name, input_unit,
           machine_category, layout_x, layout_y
    FROM ${MIDA_MACHINES}
    WHERE machine_id = $1 AND ${MIDA_PORTAL_MACHINE_FILTER}
  `;
  const params = [machine_id];

  if (locations) {
    params.push(locations);
    query += ` AND location = ANY($${params.length})`;
  } else {
    query += ` AND location ILIKE '%MIDA%'`;
  }

  const { rows } = await pool.query(query, params);
  return rows[0] ?? null;
}

export const getMidaCncMachines = async (req, res) => {
  try {
    await ensureCncMachinesTable(pool);
    const { role, id: userId } = req.user;
    const scope = await resolveCncScope(userId, role);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const { locations } = scope;
    const machineType = normalizeMachineType(req.query.type);

    let query = `
      SELECT machine_id, machine_name, location, image_url, status, last_updated,
             information, output_name, output_unit, machine_category,
             layout_x, layout_y
      FROM ${MIDA_MACHINES}
      WHERE ${getMachineTypeFilter(machineType)}
    `;
    const params = [];

    if (locations) {
      params.push(locations);
      query += ` AND location = ANY($${params.length})`;
    } else {
      query += ` AND location ILIKE '%MIDA%'`;
    }

    query += ' ORDER BY machine_name ASC';
    const { rows } = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    console.error('getMidaCncMachines error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const getMidaCncMachineById = async (req, res) => {
  try {
    const { machine_id } = req.params;
    const { role, id: userId } = req.user;
    const scope = await resolveCncScope(userId, role);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const machine = await findAuthorizedMidaMachine(machine_id, scope.locations);
    if (!machine) {
      return res.status(404).json({ error: 'Không tìm thấy máy' });
    }
    res.json(machine);
  } catch (err) {
    console.error('getMidaCncMachineById error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const getMidaCncMachineTelemetry = async (req, res) => {
  try {
    const { machine_id } = req.params;
    const { role, id: userId } = req.user;
    const scope = await resolveCncScope(userId, role);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const machine = await findAuthorizedMidaMachine(machine_id, scope.locations);
    if (!machine) {
      return res.status(404).json({ error: 'Không tìm thấy máy' });
    }

    const rows = await fetchCncTelemetryRows(pool, machine_id, machine);
    res.json(rows);
  } catch (err) {
    console.error('getMidaCncMachineTelemetry error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const getMidaCncMachineAlarms = async (req, res) => {
  try {
    const { machine_id } = req.params;
    const { role, id: userId } = req.user;
    const scope = await resolveCncScope(userId, role);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const machine = await findAuthorizedMidaMachine(machine_id, scope.locations);
    if (!machine) {
      return res.status(404).json({ error: 'Không tìm thấy máy' });
    }

    const rows = await fetchCncAlarmRows(pool, machine_id, machine);
    res.json(rows);
  } catch (err) {
    console.error('getMidaCncMachineAlarms error:', err.message);
    res.status(500).json({ error: 'Lỗi server' });
  }
};

export const bootMidaCncMachineData = async (req, res) => {
  try {
    const { machine_id } = req.params;
    const { role, id: userId } = req.user;
    const scope = await resolveCncScope(userId, role);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const machine = await findAuthorizedMidaMachine(machine_id, scope.locations);
    if (!machine) {
      return res.status(404).json({ error: 'Không tìm thấy máy' });
    }

    const deleted = await bootCncTelemetryTable(pool, machine_id, machine);
    res.status(200).send(`Đã xóa ${deleted} bản ghi, giữ lại min/max mỗi ngày của bảng ${machine_id}`);
  } catch (err) {
    console.error('bootMidaCncMachineData error:', err.message);
    res.status(500).send('Lỗi server');
  }
};

export const getPortalHome = async (req, res) => {
  res.json({
    portal: req.userScope?.portal || PORTALS.DEFAULT,
    role: req.userScope?.role,
    locations: req.userScope?.locations ?? null,
  });
};

export const addMidaCncMachine = async (req, res) => {
  const { machine_id, machine_name, location: bodyLocation, machine_type: bodyType } = req.body;
  const machineType = normalizeMachineType(bodyType);
  const inputLabel = machineType === 'ep' ? 'Ép' : 'CNC';
  const { role, id: userId } = req.user;
  const allowedLocations = await getUserAllowedLocations(userId, role);

  if (!machine_id?.trim() || !machine_name?.trim()) {
    return res.status(400).json({ error: 'Thiếu ID máy hoặc tên máy' });
  }

  const location = (bodyLocation || allowedLocations?.[0] || '').trim();
  if (!location) {
    return res.status(400).json({ error: 'Thiếu thông tin nhà máy' });
  }

  if (role !== 'admin' && !allowedLocations?.includes(location)) {
    return res.status(403).json({ error: 'Không có quyền thêm máy tại nhà máy này' });
  }

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const id = machine_id.trim();
  const telemetryTable = telemetryTableRef(id, machineType);
  const alarmTable = alarmTableRef(id, machineType);
  const client = await pool.connect();
  try {
    const existing = await machineIdExists(client, machine_id.trim());
    if (existing) {
      client.release();
      return res.status(409).json({ error: `ID máy "${machine_id}" đã tồn tại` });
    }

    await client.query('BEGIN');

    await ensureCncMachinesTable(client);

    const result = await client.query(
      `INSERT INTO ${MIDA_MACHINES} (
        machine_id, machine_name, location, image_url, isdtgroup,
        machine_category, input_name, input_unit
      ) VALUES ($1, $2, $3, $4, false, $5, $6, '-')
      RETURNING *`,
      [id, machine_name.trim(), location, imagePath, machineType, inputLabel],
    );

    if (machineType === 'cnc') {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${telemetryTable} (
          id SERIAL PRIMARY KEY,
          nr INTEGER,
          machine_id VARCHAR(255),
          timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          time_on INTEGER,
          time_running INTEGER,
          phase1_v REAL,
          phase2_v REAL,
          phase3_v REAL,
          avg_v REAL,
          phase1_a REAL,
          phase2_a REAL,
          phase3_a REAL,
          avg_a REAL,
          power REAL,
          power_consumption REAL,
          frequency REAL,
          status INTEGER
        );
      `);
      await ensureCncElectricalTelemetryColumns(client, telemetryTable);
    } else {
      await client.query(`
        CREATE TABLE IF NOT EXISTS ${telemetryTable} (
          id SERIAL PRIMARY KEY,
          nr INTEGER,
          machine_id VARCHAR(255),
          timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
          shoot REAL,
          cycle INTEGER,
          time_on INTEGER,
          time_off INTEGER,
          check_get BOOLEAN,
          product REAL,
          status INTEGER,
          input_material REAL
        );
      `);
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS ${alarmTable} (
        id SERIAL PRIMARY KEY,
        nr INTEGER,
        machine_id VARCHAR(255),
        timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
        alarm_code TEXT,
        alarm_id TEXT,
        alarm_name TEXT,
        check_get BOOL
      );
    `);
    await client.query('COMMIT');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('addMidaCncMachine error:', err.message);
    if (err.code === '23505') {
      return res.status(409).json({ error: `ID máy "${machine_id}" đã tồn tại` });
    }
    res.status(500).json({ error: 'Lỗi khi thêm máy CNC' });
  } finally {
    client.release();
  }
};

export const deleteMidaCncMachine = async (req, res) => {
  const { machine_id } = req.params;
  const { role, id: userId } = req.user;

  try {
    const scope = await resolveCncScope(userId, role);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const { locations } = scope;
    let query = `
      SELECT machine_id, machine_category
      FROM ${MIDA_MACHINES}
      WHERE machine_id = $1 AND ${MIDA_PORTAL_MACHINE_FILTER}
    `;
    const params = [machine_id];

    if (locations) {
      params.push(locations);
      query += ` AND location = ANY($${params.length})`;
    } else {
      query += ` AND location ILIKE '%MIDA%'`;
    }

    const { rows } = await pool.query(query, params);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Không tìm thấy máy' });
    }

    const machine = rows[0];
    const alarmTable = alarmTableRef(machine_id, machine);
    const telemetryTable = telemetryTableRef(machine_id, machine);

    await pool.query(`DROP TABLE IF EXISTS ${alarmTable}`);
    await pool.query(`DELETE FROM ${MIDA_MACHINES} WHERE machine_id = $1`, [machine_id]);
    await pool.query(`DROP TABLE IF EXISTS ${telemetryTable}`);

    res.json({ message: 'Xoá máy thành công' });
  } catch (err) {
    console.error('deleteMidaCncMachine error:', err.message);
    res.status(500).json({ error: 'Lỗi xoá máy' });
  }
};

export const updateMidaMachineLayout = async (req, res) => {
  const { machine_id } = req.params;
  const { layout_x, layout_y } = req.body;
  const { role, id: userId } = req.user;

  const x = Number(layout_x);
  const y = Number(layout_y);
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    return res.status(400).json({ error: 'layout_x và layout_y phải là số từ 0 đến 100' });
  }

  try {
    const scope = await resolveCncScope(userId, role);
    if (scope.error) return res.status(scope.status).json({ error: scope.error });

    const { locations } = scope;
    let query = `
      UPDATE ${MIDA_MACHINES}
      SET layout_x = $1, layout_y = $2
      WHERE machine_id = $3 AND ${MIDA_PORTAL_MACHINE_FILTER}
    `;
    const params = [x, y, machine_id];

    if (locations) {
      params.push(locations);
      query += ` AND location = ANY($${params.length})`;
    } else {
      query += ` AND location ILIKE '%MIDA%'`;
    }

    query += ' RETURNING machine_id, machine_name, layout_x, layout_y';
    await ensureCncMachinesTable(pool);
    const { rows, rowCount } = await pool.query(query, params);
    if (rowCount === 0) {
      return res.status(404).json({ error: 'Không tìm thấy máy' });
    }
    res.json(rows[0]);
  } catch (err) {
    console.error('updateMidaMachineLayout error:', err.message);
    res.status(500).json({ error: 'Lỗi khi lưu vị trí layout' });
  }
};