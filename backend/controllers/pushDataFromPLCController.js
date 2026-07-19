import pool from '../db.js';
import { saveProductionRow } from '../utils/productionPersistence.js';
import {
  alarmTableRef,
  findMachinesRegistryTable,
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
