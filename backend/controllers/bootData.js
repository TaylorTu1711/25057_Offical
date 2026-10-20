import pool from "../db.js";

export const bootData = async (req, res) => {
  try {
    const machine_id = req.params.id;

    // ✅ Validate tên bảng (tránh SQL Injection)
    if (!machine_id || !/^[a-zA-Z0-9_]+$/.test(machine_id)) {
      return res.status(400).send("Tên bảng không hợp lệ");
    }

    const query = `
      DELETE FROM "${machine_id}" AS t
      USING (
        SELECT
          DATE("timestamp") AS date_day,
          MIN("timestamp") AS min_time,
          MAX("timestamp") AS max_time
        FROM "${machine_id}"
        WHERE DATE("timestamp") <> CURRENT_DATE
        GROUP BY DATE("timestamp")
      ) AS keep
      WHERE DATE(t."timestamp") = keep.date_day
        AND t."timestamp" NOT IN (keep.min_time, keep.max_time);
    `;


    const result = await pool.query(query);

    return res
      .status(200)
      .send(`Đã xóa ${result.rowCount} bản ghi, giữ lại min/max mỗi ngày của bảng ${machine_id}`);
  } catch (err) {
    console.error(err);
    return res.status(500).send("Lỗi server");
  }
};