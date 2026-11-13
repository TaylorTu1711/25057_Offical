import pool from '../db.js';
import { isCncElectricalRow, saveCncTelemetryRow } from '../utils/cncTelemetry.js';
import { isDtrCountsRow, saveDtrTelemetryRow } from '../utils/dtrTelemetry.js';
import { saveProductionRow } from '../utils/productionPersistence.js';
import {
  alarmTableRef,
  DTR_MACHINES_TABLE,
  findMachinesRegistryTable,
  isCncMachine,
  telemetryTableRef,
} from '../utils/machineSchema.js';

export const pushDataFromPLC = async (req, res) => {
  const dataArray = req.body;

  console.log('Dữ liệu nhận từ PLC:');
  console.log(JSON.stringify(dataArray, null, 2));

  if (!Array.isArray(dataArray) || dataArray.length === 0) {
    return res.status(400).json({ error: 'Dữ liệu không hợp lệ hoặc rỗng' });
  }

  try {
    for (let row of dataArray) {
      const { machine_id } = row;

      if (!machine_id) {
        console.warn('Thiếu machine_id trong bản ghi:', row);
        continue;
      }

      // DTR Sort: payload có counts (machine_id có thể là 25231_100_70_140_122)
      if (isDtrCountsRow(row)) {
        const result = await saveDtrTelemetryRow(pool, machine_id, row);
        if (result.reason === 'machine_not_found') {
          console.warn('Không tìm thấy máy DTR:', machine_id);
          continue;
        }
        if (result.reason === 'invalid_timestamp') {
          console.warn('timestamp không hợp lệ, bỏ qua bản ghi DTR:', row);
          continue;
        }

        if (result.registryId) {
          const { timestamp } = row;
          const statusNum = row.status == null || row.status === ''
            ? null
            : Number(row.status);
          await pool.query(
            `UPDATE ${DTR_MACHINES_TABLE}
             SET last_updated = COALESCE($1::timestamptz, CURRENT_TIMESTAMP),
                 status = COALESCE($2::integer, status),
                 updated_at = CURRENT_TIMESTAMP
             WHERE machine_id = $3`,
            [
              timestamp || null,
              Number.isFinite(statusNum) ? Math.trunc(statusNum) : null,
              result.registryId,
            ],
          );
        }
        continue;
      }

      const found = await findMachinesRegistryTable(pool, machine_id);
      if (!found) {
        console.warn('Không tìm thấy máy:', machine_id);
        continue;
      }

      const { table: registryTable, machine } = found;
      const tableName = telemetryTableRef(machine_id, machine);
      const alarmTableName = alarmTableRef(machine_id, machine);

      const isAlarm = Object.prototype.hasOwnProperty.call(row, 'alarm_code')
        && Object.prototype.hasOwnProperty.call(row, 'alarm_id');
      const isCncTelemetry = isCncMachine(machine) && isCncElectricalRow(row);
      const isProduction = Object.prototype.hasOwnProperty.call(row, 'shoot')
        && Object.prototype.hasOwnProperty.call(row, 'product');
      const isStatus = Object.prototype.hasOwnProperty.call(row, 'status_value');

      if (isAlarm) {
        const { nr, timestamp, alarm_code, alarm_id, alarm_name, check_get } = row;
        await pool.query(
          `INSERT INTO ${alarmTableName} (nr, machine_id, timestamp, alarm_code, alarm_id, alarm_name, check_get)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [nr, machine_id, timestamp, alarm_code, alarm_id, alarm_name, check_get],
        );
      } else if (isCncTelemetry) {
        // Live: luôn cập nhật registry. History: INSERT có throttle 10s / bắt buộc khi status đổi.
        const result = await saveCncTelemetryRow(pool, tableName, machine_id, row);
        if (result.reason === 'table_missing') {
          console.warn('Chưa có bảng telemetry CNC:', tableName);
          continue;
        }
        if (result.reason === 'invalid_timestamp') {
          console.warn('timestamp không hợp lệ, bỏ qua bản ghi CNC:', row);
          continue;
        }

        const { timestamp, status } = row;
        await pool.query(
          `UPDATE ${registryTable}
           SET last_updated = COALESCE($1::timestamptz, CURRENT_TIMESTAMP),
               status = COALESCE($2, status)
           WHERE machine_id = $3`,
          [timestamp || null, status ?? null, machine_id],
        );
      } else if (isProduction) {
        let { timestamp, status } = row;

        if (status == null || status === '') {
          const { rows: machineRows } = await pool.query(
            `SELECT status FROM ${registryTable} WHERE machine_id = $1`,
            [machine_id],
          );
          status = machineRows[0]?.status ?? null;
          row = { ...row, status };
        }

        const result = await saveProductionRow(pool, tableName, machine_id, row, registryTable);
        if (result.reason === 'invalid_shoot') {
          console.warn('shoot không hợp lệ, bỏ qua bản ghi:', row);
          continue;
        }
        if (result.reason === 'invalid_product') {
          console.warn('product không hợp lệ, bỏ qua bản ghi:', row);
          continue;
        }
        if (result.reason === 'invalid_timestamp') {
          console.warn('timestamp không hợp lệ, bỏ qua bản ghi:', row);
          continue;
        }

        await pool.query(
          `UPDATE ${registryTable}
           SET last_updated = $1,
               status = COALESCE($2, status)
           WHERE machine_id = $3`,
          [timestamp, status, machine_id],
        );
      } else if (isStatus) {
        const { status_value, timestamp } = row;

        await pool.query(
          `UPDATE ${registryTable}
           SET status = $1,
               last_updated = $2
           WHERE machine_id = $3`,
          [status_value, timestamp, machine_id],
        );
      } else {
        console.warn('Bản ghi không hợp lệ:', row);
      }
    }

    return res.status(201).json({ status: 'Đã nhận dữ liệu thành công' });
  } catch (error) {
    console.error('Lỗi ghi DB:', error.message);
    return res.status(500).json({ error: error.message });
  }
};
