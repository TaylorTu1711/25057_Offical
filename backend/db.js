import { Pool, types } from "pg";

// ⚙️ Giữ nguyên giá trị timestamp như trong PostgreSQL
types.setTypeParser(1114, str => str);  // TIMESTAMP WITHOUT TIME ZONE
types.setTypeParser(1184, str => str);  // TIMESTAMP WITH TIME ZONE (tùy trường hợp)
const pool = new Pool({
    user: "postgres",
    password: "123456",
    host: "localhost",
    port: 5432,
    database: "postgres"
});

export default pool;
