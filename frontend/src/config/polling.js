/** Khoảng thời gian làm mới dữ liệu (ms) */
export const POLL_INTERVALS = {
  /** Trạng thái chạy/dừng, kết nối */
  status: 3_000,
  /** Cảnh báo, biểu đồ, hiệu suất */
  live: 5_000,
  /** Danh sách máy / sidebar */
  locations: 15_000,
  /** Cập nhật UI kết nối (mất kết nối sau X phút) */
  connectionTick: 3_000,
};
