-- Thêm 1 dòng vào bảng máy 25097_1_10_26_8_2
-- Chạy: psql -h localhost -U postgres -d postgres -f backend/scripts/insert-row-25097_1_10_26_8_2.sql
-- (hoặc sudo -u postgres psql -d postgres -f ...)

INSERT INTO "25097_1_10_26_8_2" (
  nr,
  machine_id,
  timestamp,
  shoot,
  cycle,
  time_on,
  time_off,
  check_get,
  product,
  status,
  input_material
) VALUES (
  8535,                      -- nr: tăng so với dòng 8534 (sửa theo PLC)
  '25097_1_10_26_8_2',
  NOW(),                     -- hoặc '2026-05-31 10:00:00'
  1098.5,                    -- shoot: REAL (integer hoặc số thập phân)
  3600,
  1582973,
  0,
  false,
  878,                       -- product (sửa theo thực tế)
  2,                         -- status: 2 = Run (theo SCADA)
  NULL                       -- input_material (hoặc 0, 100.5...)
)
RETURNING id, nr, machine_id, timestamp, shoot, product, status;
