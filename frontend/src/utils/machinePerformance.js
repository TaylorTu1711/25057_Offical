/** Bắt đầu ngày theo giờ local. */
export const startOfLocalDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/** Số ngày lịch (đủ T2–CN) từ from đến to, tính cả hai đầu mút. */
export const countCalendarDaysInclusive = (fromDate, toDate) => {
  const from = startOfLocalDay(fromDate);
  const to = startOfLocalDay(toDate);
  if (from > to) return 0;
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((to.getTime() - from.getTime()) / msPerDay) + 1;
};

/** Ngày đầu tiên có dữ liệu = thời điểm máy được đưa vào hoạt động. */
export const getFirstOperationDate = (rawRows = [], dailyRows = []) => {
  let earliest = null;

  const consider = (timestamp) => {
    if (!timestamp) return;
    const t = new Date(timestamp);
    if (Number.isNaN(t.getTime())) return;
    if (!earliest || t < earliest) earliest = t;
  };

  rawRows.forEach((row) => consider(row.timestamp));
  dailyRows.forEach((row) => consider(row.timestamp));
  dailyRows.forEach((row) => consider(row.min_timestamp));

  return earliest ? startOfLocalDay(earliest) : null;
};

/**
 * Hiệu suất khai thác / sử dụng (%) =
 * tổng thời gian bật máy (giờ) / (số ngày lịch từ ngày vận hành đến hôm nay × 24h) × 100
 * (Portal MIDA: time_on; portal máy thường: time_on tương đương thời gian chạy.)
 */
export function calcUsagePerformancePct(totalTimeOnSeconds, rawRows, dailyRows, now = new Date()) {
  const onSec = Number(totalTimeOnSeconds) || 0;
  if (onSec <= 0) return 0;

  const firstOp = getFirstOperationDate(rawRows, dailyRows);
  if (!firstOp) return 0;

  const calendarDays = countCalendarDaysInclusive(firstOp, startOfLocalDay(now));
  if (calendarDays <= 0) return 0;

  const totalCalendarHours = calendarDays * 24;
  const onHours = onSec / 3600;
  const pct = (onHours / totalCalendarHours) * 100;

  return Math.min(100, Number(pct.toFixed(1)));
}
