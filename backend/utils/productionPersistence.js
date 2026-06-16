import { parseReal } from './numeric.js';

/** Khoảng cách tối thiểu giữa hai bản ghi mới (giây). Mặc định 5 phút. */
export function getProductionSaveIntervalSec() {
  const raw = Number(process.env.PRODUCTION_SAVE_INTERVAL_SEC ?? 300);
  if (!Number.isFinite(raw) || raw < 60) return 300;
  return Math.min(raw, 3600);
}

function valuesEqual(a, b) {
  return (
    Number(a.shoot) === Number(b.shoot)
    && Number(a.product) === Number(b.product)
    && Number(a.time_on) === Number(b.time_on)
    && Number(a.time_off) === Number(b.time_off)
    && Number(a.input_material) === Number(b.input_material)
    && Number(a.status) === Number(b.status)
    && Number(a.cycle) === Number(b.cycle)
    && Boolean(a.check_get) === Boolean(b.check_get)
  );
}

/**
 * Giảm số dòng lưu trong bảng máy mà vẫn đủ cho biểu đồ:
 * - Bản ghi đầu ngày giữ snapshot mở (min).
 * - Trong cửa sổ interval: UPDATE bản ghi mới nhất (max).
 * - Hết cửa sổ: INSERT bản ghi mới (mẫu ~5 phút cho biểu đồ trạng thái 24h).
 */
export async function saveProductionRow(pool, tableName, machineId, row) {
  const {
    nr,
    timestamp,
    shoot,
    cycle,
    time_on,
    time_off,
    check_get,
    product,
    status,
    input_material,
  } = row;

  const shootValue = parseReal(shoot);
  const productValue = parseReal(product);

  if (shootValue === null) {
    return { saved: false, reason: 'invalid_shoot' };
  }
  if (productValue === null) {
    return { saved: false, reason: 'invalid_product' };
  }

  const intervalMs = getProductionSaveIntervalSec() * 1000;
  const rowTs = new Date(timestamp);
  if (Number.isNaN(rowTs.getTime())) {
    return { saved: false, reason: 'invalid_timestamp' };
  }

  const { rows: todayRows } = await pool.query(
    `SELECT id, timestamp, shoot, product, time_on, time_off, input_material, status, cycle, check_get
     FROM ${tableName}
     WHERE timestamp::date = $1::timestamptz::date
     ORDER BY timestamp ASC, id ASC`,
    [timestamp],
  );

  const fields = {
    nr,
    machine_id: machineId,
    timestamp,
    shoot: shootValue,
    cycle,
    time_on,
    time_off,
    check_get,
    product: productValue,
    status: status != null && status !== '' ? status : null,
    input_material,
  };

  if (fields.status == null && todayRows.length > 0) {
    const prevStatus = todayRows[todayRows.length - 1]?.status;
    if (prevStatus != null && prevStatus !== '') {
      fields.status = prevStatus;
    }
  }

  if (fields.status == null) {
    const { rows: machineRows } = await pool.query(
      `SELECT status FROM machines WHERE machine_id = $1`,
      [machineId],
    );
    if (machineRows[0]?.status != null && machineRows[0]?.status !== '') {
      fields.status = machineRows[0].status;
    }
  }

  const insertRow = async () => {
    await pool.query(
      `INSERT INTO ${tableName}
        (nr, machine_id, timestamp, shoot, cycle, time_on, time_off, check_get, product, status, input_material)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        fields.nr,
        fields.machine_id,
        fields.timestamp,
        fields.shoot,
        fields.cycle,
        fields.time_on,
        fields.time_off,
        fields.check_get,
        fields.product,
        fields.status,
        fields.input_material,
      ],
    );
  };

  const updateRow = async (id) => {
    await pool.query(
      `UPDATE ${tableName}
       SET nr = $1,
           timestamp = $2,
           shoot = $3,
           cycle = $4,
           time_on = $5,
           time_off = $6,
           check_get = $7,
           product = $8,
           status = $9,
           input_material = $10
       WHERE id = $11`,
      [
        fields.nr,
        fields.timestamp,
        fields.shoot,
        fields.cycle,
        fields.time_on,
        fields.time_off,
        fields.check_get,
        fields.product,
        fields.status,
        fields.input_material,
        id,
      ],
    );
  };

  if (todayRows.length === 0) {
    await insertRow();
    return { saved: true, action: 'insert', reason: 'first_of_day' };
  }

  const latest = todayRows[todayRows.length - 1];
  const latestTs = new Date(latest.timestamp).getTime();
  const elapsed = rowTs.getTime() - latestTs;
  const withinWindow = elapsed < intervalMs;
  const unchanged = valuesEqual(latest, fields);

  if (todayRows.length === 1) {
    if (withinWindow) {
      if (unchanged) {
        return { saved: false, action: 'skip', reason: 'unchanged_within_window' };
      }
      await updateRow(latest.id);
      return { saved: true, action: 'update', reason: 'single_row_window' };
    }

    await insertRow();
    return { saved: true, action: 'insert', reason: 'new_interval' };
  }

  // Đã có ≥2 dòng: giữ bản ghi đầu ngày (min), chỉ cập nhật bản ghi mới nhất (max).
  if (withinWindow) {
    if (unchanged) {
      return { saved: false, action: 'skip', reason: 'unchanged_within_window' };
    }
    await updateRow(latest.id);
    return { saved: true, action: 'update', reason: 'latest_window' };
  }

  await insertRow();
  return { saved: true, action: 'insert', reason: 'new_interval' };
}
