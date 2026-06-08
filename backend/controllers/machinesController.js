import express from "express";
import pool from "../db.js";



export const getMachinesByLocation = async (req, res) => {
  const { location, isdtgroup } = req.query;

  if (!location || typeof isdtgroup === 'undefined') {
    return res.status(400).json({ error: 'Missing location or isdtgroup parameter' });
  }

  try {
    const result = await pool.query(
      'SELECT * FROM machines WHERE location = $1 AND isdtgroup = $2 ORDER BY machine_name',
      [location, isdtgroup === 'true'] // chuyển về boolean
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error getting machines', err);
    res.status(500).json({ error: 'Internal Server Error' });
  }
};



export const addMachine = async (req, res) => {
  const {
    machine_id,
    machine_name,
    location,
    isdtgroup,

    // 👇 thêm mới
    output_name,
    output_unit,
    input_name,
    input_unit
  } = req.body;

  const imagePath = req.file ? `/uploads/${req.file.filename}` : null;
  const isDT = isdtgroup === 'true';

  // 🔒 validate
  if (!machine_id || !machine_name || !location || !input_name || !input_unit) {
    return res.status(400).json({ error: 'Thiếu thông tin bắt buộc' });
  }

  const outputName = (output_name || '').trim() || null;
  const outputUnit = (output_unit || '').trim() || null;

  const client = await pool.connect();
  const alarmTable = `alarm${machine_id}`;

  try {
    const existing = await client.query(
      'SELECT machine_id FROM machines WHERE machine_id = $1',
      [machine_id],
    );
    if (existing.rowCount > 0) {
      client.release();
      return res.status(409).json({
        error: `ID máy "${machine_id}" đã tồn tại. Vui lòng dùng ID khác hoặc xóa máy cũ trước.`,
      });
    }

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO machines (
        machine_id,
        machine_name,
        location,
        image_url,
        isdtgroup,
        output_name,
        output_unit,
        input_name,
        input_unit
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        machine_id,
        machine_name,
        location,
        imagePath,
        isDT,
        outputName,
        outputUnit,
        input_name,
        input_unit,
      ],
    );

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${machine_id}" (
        id SERIAL PRIMARY KEY,
        nr INTEGER,
        machine_id VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        shoot REAL,
        cycle REAL,
        time_on REAL,
        time_off REAL,
        check_get BOOL,
        product INTEGER,
        status INTEGER,
        input_material REAL
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS "${alarmTable}" (
        id SERIAL PRIMARY KEY,
        nr INTEGER,
        machine_id VARCHAR(255),
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    console.error('Error adding machine:', err);

    if (err.code === '23505') {
      return res.status(409).json({
        error: `ID máy "${machine_id}" đã tồn tại. Vui lòng dùng ID khác hoặc xóa máy cũ trước.`,
      });
    }

    res.status(500).json({
      error: 'Lỗi khi thêm máy. Vui lòng thử lại hoặc liên hệ quản trị.',
    });
  } finally {
    client.release();
  }
};


export const deleteMachine = async (req, res) => {

  const machine_id = req.params.id;
  const alarmTableName = `alarm${machine_id}`;
  try {
    await pool.query(`DROP TABLE IF EXISTS "${alarmTableName}"`);
    await pool.query('DELETE FROM machines WHERE machine_id = $1', [machine_id]);
    await pool.query(`DROP TABLE IF EXISTS "${machine_id}"`);
    res.status(200).json({ message: 'Xoá thành công' });
  } catch (err) {
    res.status(500).json({ error: 'Lỗi xoá máy' });
  }
};

export const getMachineByID = async (req, res) => {

  const machine_id = req.params.id;
  try {
    const machine_infor = await pool.query(`SELECT * FROM machines WHERE machine_id = $1`, [machine_id]);
    res.json(machine_infor.rows);
  } catch (err) {
    console.error(err.message);
  }
};

export const updateMachineByID = async (req, res) => {
  const machine_id = req.params.id;

  const {
    machine_name,
    location,
    information,

    // 👇 thêm mới
    output_name,
    output_unit,
    input_name,
    input_unit
  } = req.body;

  // 🔒 validate
  if (!machine_name || !location) {
    return res.status(400).json({ message: 'Thiếu thông tin bắt buộc' });
  }

  try {
    const result = await pool.query(
      `UPDATE machines 
       SET machine_name = $1, 
           location = $2, 
           information = $3,
           output_name = $4,
           output_unit = $5,
           input_name = $6,
           input_unit = $7
       WHERE machine_id = $8
       RETURNING *`,
      [
        machine_name,
        location,
        information,
        output_name,
        output_unit,
        input_name,
        input_unit,
        machine_id
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: 'Không tìm thấy máy để cập nhật' });
    }

    res.json({
      message: 'Cập nhật thông tin máy thành công',
      data: result.rows[0]
    });

  } catch (err) {
    console.error(err.message);
    res.status(500).json({ message: 'Lỗi server khi cập nhật máy' });
  }
};


