import pool from "../db.js";
import { saveProductionRow } from "../utils/productionPersistence.js";

export const pushDataFromPLC = async (req, res) => {
    const dataArray = req.body;

    console.log("Dữ liệu nhận từ PLC:");
    console.log(JSON.stringify(dataArray, null, 2));

    if (!Array.isArray(dataArray) || dataArray.length === 0) {
        return res.status(400).json({ error: 'Dữ liệu không hợp lệ hoặc rỗng' });
    }
    

    try {
        for (const row of dataArray) {
            const { machine_id } = row;

            if (!machine_id) {
                console.warn('Thiếu machine_id trong bản ghi:', row);
                continue;
            }

            const tableName = `"${machine_id}"`;
            const alarmTableName = `alarm${machine_id}`;
            if (!tableName) {
                console.warn('machine_id không hợp lệ:', machine_id);
                continue;
            }

            // Xác định loại bản ghi
            const isAlarm = row.hasOwnProperty('alarm_code') && row.hasOwnProperty('alarm_id');
            const isProduction = row.hasOwnProperty('shoot') && row.hasOwnProperty('product');
            const isStatus = row.hasOwnProperty('status_value');

            if (isAlarm) {
                const { nr, timestamp, alarm_code, alarm_id, alarm_name, check_get } = row;
                await pool.query(
                    `INSERT INTO ${alarmTableName} (nr, machine_id, timestamp, alarm_code, alarm_id, alarm_name, check_get)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [nr, machine_id, timestamp, alarm_code, alarm_id, alarm_name, check_get]
                );
            } else if (isProduction) {
                const { timestamp, status } = row;

                const result = await saveProductionRow(pool, tableName, machine_id, row);
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
                    `UPDATE machines
                     SET last_updated = $1,
                         status = COALESCE($2, status)
                     WHERE machine_id = $3`,
                    [timestamp, status, machine_id]
                );
            } else if(isStatus){
                const { stt, status_name, status_value, timestamp } = row;

                await pool.query(
                `UPDATE machines
                SET status = $1,
                    last_updated = $2
                WHERE machine_id = $3`,
                [status_value, timestamp, machine_id]
                );

            }          
            else {
                console.warn('Bản ghi không hợp lệ:', row);
            }
        }

        return res.status(201).json({"status":"Đã nhận dữ liệu thành công"});
    } catch (error) {
        console.error('Lỗi ghi DB:', error.message);
        return res.status(500).json({ error: error.message });
    }
};
