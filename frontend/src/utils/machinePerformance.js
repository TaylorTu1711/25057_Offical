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
 * Hiệu suất khai thác (%) =
 * time_on / (thời gian từ mẫu đầu tiên → mẫu mới nhất) × 100
 */
export function calcUsagePerformancePct(totalTimeOnSeconds, rawRows, dailyRows) {
  const onSec = Number(totalTimeOnSeconds) || 0;
  if (onSec <= 0) return 0;

  const firstTs = getFirstDataTimestamp(rawRows, dailyRows);
  const latestTs = getLatestDataTimestamp(rawRows, dailyRows);
  if (!firstTs || !latestTs) return 0;

  const elapsedSec = (latestTs.getTime() - firstTs.getTime()) / 1000;
  if (elapsedSec <= 0) return 0;

  const pct = (onSec / elapsedSec) * 100;
  return Math.min(100, Number(pct.toFixed(1)));
}
