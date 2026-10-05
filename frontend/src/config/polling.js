/** Khoảng thời gian làm mới dữ liệu (ms) */
export const POLL_INTERVALS = {
  /** Trạng thái chạy/dừng, kết nối */
  status: 3_000,
  /** Cảnh báo + hiệu suất tổng (không kèm full telemetry) */
  live: 5_000,
  /** Telemetry biểu đồ (nặng) — chậm hơn để UI mượt khi đổi tháng */
  telemetry: 15_000,
  /** Danh sách máy / sidebar */
  locations: 15_000,
  /** Cập nhật UI kết nối (chưa kết nối sau X phút) */
  connectionTick: 3_000,
};
