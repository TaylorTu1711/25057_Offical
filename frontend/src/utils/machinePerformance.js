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

/** Timestamp sớm nhất trong dữ liệu (thời điểm bắt đầu gửi). */
export const getFirstDataTimestamp = (rawRows = [], dailyRows = []) => {
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

  return earliest;
};

/** Timestamp mới nhất trong dữ liệu. */
export const getLatestDataTimestamp = (rawRows = [], dailyRows = []) => {
  let latest = null;

  const consider = (timestamp) => {
    if (!timestamp) return;
    const t = new Date(timestamp);
    if (Number.isNaN(t.getTime())) return;
    if (!latest || t > latest) latest = t;
  };

  rawRows.forEach((row) => consider(row.timestamp));
  dailyRows.forEach((row) => consider(row.timestamp));
  dailyRows.forEach((row) => consider(row.max_timestamp));

  return latest;
};

/** Ngày đầu tiên có dữ liệu = thời điểm máy được đưa vào hoạt động. */
export const getFirstOperationDate = (rawRows = [], dailyRows = []) => {
  const earliest = getFirstDataTimestamp(rawRows, dailyRows);
  return earliest ? startOfLocalDay(earliest) : null;
};

/**
 * Hiệu suất theo cửa sổ dữ liệu (%) =
 * tổng thời gian (giây) / (timestamp mẫu mới nhất − mẫu đầu tiên) × 100
 * MIDA CNC: truyền time_running. Portal khác có thể truyền time_on.
 */
export function calcUsagePerformancePct(totalSeconds, rawRows, dailyRows) {
  const firstTs = getFirstDataTimestamp(rawRows, dailyRows);
  const latestTs = getLatestDataTimestamp(rawRows, dailyRows);
  return calcUsagePerformancePctFromSpan(totalSeconds, firstTs, latestTs);
}

/** Hiệu suất sử dụng từ mốc đầu/cuối đã biết (toàn lịch sử). */
export function calcUsagePerformancePctFromSpan(totalSeconds, firstTs, latestTs) {
  const sec = Number(totalSeconds) || 0;
  if (sec <= 0) return 0;

  const first = firstTs instanceof Date ? firstTs : (firstTs ? new Date(firstTs) : null);
  const latest = latestTs instanceof Date ? latestTs : (latestTs ? new Date(latestTs) : null);
  if (!first || !latest || Number.isNaN(first.getTime()) || Number.isNaN(latest.getTime())) {
    return 0;
  }

  const elapsedSec = (latest.getTime() - first.getTime()) / 1000;
  if (elapsedSec <= 0) return 0;

  const pct = (sec / elapsedSec) * 100;
  return Math.min(100, Number(pct.toFixed(1)));
}
