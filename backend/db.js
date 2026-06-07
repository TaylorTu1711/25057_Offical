import pg from "pg";
const { Pool, types } = pg;

// ⚙️ Giữ nguyên giá trị timestamp như trong PostgreSQL (không convert sang UTC)
types.setTypeParser(1114, str => str);  // 1114 = TIMESTAMP WITHOUT TIME ZONE
types.setTypeParser(1184, str => str);  // 1184 = TIMESTAMP WITH TIME ZONE (phòng trường hợp bạn dùng loại này)

const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "Plenma123456@",
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME || "postgres"
});

export default pool;

