import pool from "../db.js";

export const bootData = async (req, res) => {
  try {
    const machine_id = req.params.id; // <-- lấy từ params
    if (!machine_id) {
      return res.status(400).send("Thiếu machine_id");
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
    res.status(200).send(`Đã xóa ${result.rowCount} bản ghi chỉ dữ lại Min, Max của bảng ${machine_id}`);
  } catch (err) {
    res.status(500).send("Lỗi server");
  }
};
