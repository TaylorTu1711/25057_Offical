-- Migrate shoot INTEGER -> REAL cho tất cả bảng máy trong bảng machines.
-- Chạy: psql -U postgres -d postgres -f backend/scripts/migrate-shoot-to-real.sql

DO $$
DECLARE
  r RECORD;
  col_type TEXT;
BEGIN
  FOR r IN SELECT machine_id FROM machines ORDER BY machine_id
  LOOP
    SELECT c.data_type INTO col_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = r.machine_id
      AND c.column_name = 'shoot';

    IF col_type IS NULL THEN
      RAISE NOTICE '[skip] %: không có cột shoot', r.machine_id;
    ELSIF col_type IN ('real', 'double precision', 'numeric') THEN
      RAISE NOTICE '[ok]   %: shoot đã là %', r.machine_id, col_type;
    ELSE
      EXECUTE format(
        'ALTER TABLE %I ALTER COLUMN shoot TYPE REAL USING shoot::real',
        r.machine_id
      );
      RAISE NOTICE '[done] %: shoot % -> REAL', r.machine_id, col_type;
    END IF;
  END LOOP;
END $$;
