import { toStatusChartValue } from './machineStatus';

export function generateTimestampsInRange(start, end, intervalMinutes = 5) {
  const timestamps = [];
  const current = new Date(start);
  while (current <= end) {
    timestamps.push(new Date(current));
    current.setMinutes(current.getMinutes() + intervalMinutes);
  }
  return timestamps;
}

/** Căn mốc thời gian theo interval (ổn định trục khi polling). */
function alignToInterval(date, intervalMinutes, mode = 'floor') {
  const ms = intervalMinutes * 60 * 1000;
  const t = new Date(date).getTime();
  if (!Number.isFinite(t)) return new Date(date);
  return new Date(
    mode === 'ceil' ? Math.ceil(t / ms) * ms : Math.floor(t / ms) * ms,
  );
}

/** Căn mốc theo interval mili-giây (dùng cho độ phân giải giây). */
function alignToIntervalMs(date, intervalMs, mode = 'floor') {
  const t = new Date(date).getTime();
  if (!Number.isFinite(t) || intervalMs <= 0) return new Date(date);
  return new Date(
    mode === 'ceil' ? Math.ceil(t / intervalMs) * intervalMs : Math.floor(t / intervalMs) * intervalMs,
  );
}

/** Sinh mốc thời gian theo bước mili-giây. */
function generateTimestampsInRangeMs(start, end, intervalMs) {
  const timestamps = [];
  if (intervalMs <= 0) return timestamps;
  let t = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  while (t <= endMs) {
    timestamps.push(new Date(t));
    t += intervalMs;
  }
  return timestamps;
}

/**
 * Biểu đồ trạng thái — forward-fill theo mẫu telemetry (bucket mặc định 1 phút).
 * Không tô quá khứ bằng trạng thái live; live chỉ gắn điểm cuối cửa sổ.
 */
export function buildStatusTimelineChart(
  rawMachineData,
  effectiveFrom,
  effectiveTo,
  intervalMinutes = 1,
  currentStatus = null,
) {
  const alignedTo = alignToInterval(effectiveTo, intervalMinutes, 'floor');
  const windowMs = Math.max(
    0,
    new Date(effectiveTo).getTime() - new Date(effectiveFrom).getTime(),
  );
  const alignedFrom = alignToInterval(
    new Date(alignedTo.getTime() - windowMs),
    intervalMinutes,
    'floor',
  );
  const fromMs = alignedFrom.getTime();
  const toMs = alignedTo.getTime();

  const allSorted = (Array.isArray(rawMachineData) ? rawMachineData : [])
    .filter((d) => d?.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  // Seed chỉ từ lịch sử trước cửa sổ — không dùng live status (tránh tô sai quá khứ)
  let lastStatus = null;
  for (const d of allSorted) {
    const ts = new Date(d.timestamp).getTime();
    if (ts >= fromMs) break;
    const s = toStatusChartValue(d.status);
    if (s != null) lastStatus = s;
  }

  const rangeFiltered = allSorted.filter((d) => {
    const ts = new Date(d.timestamp).getTime();
    return ts >= fromMs && ts <= toMs;
  });

  const rangeTimestamps = generateTimestampsInRange(alignedFrom, alignedTo, intervalMinutes);
  let ptr = 0;

  const mappedData = rangeTimestamps.map((t) => {
    const tMs = t.getTime();
    while (ptr < rangeFiltered.length && new Date(rangeFiltered[ptr].timestamp).getTime() <= tMs) {
      const s = toStatusChartValue(rangeFiltered[ptr].status);
      if (s != null) lastStatus = s;
      ptr += 1;
    }
    return lastStatus;
  });

  const live = toStatusChartValue(currentStatus);
  if (mappedData.length > 0 && live != null) {
    mappedData[mappedData.length - 1] = live;
  }

  const spanDays = windowMs / (24 * 60 * 60 * 1000);
  const labels = rangeTimestamps.map((t) =>
    spanDays > 1.05
      ? t.toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  );

  return { labels, mappedData };
}

/** Sinh mốc thời gian: hôm nay mỗi 10s, các ngày trước mỗi 5 phút. */
function generateAdaptivePowerTimestamps(start, end, todayRef = new Date()) {
  const todayStart = new Date(todayRef);
  todayStart.setHours(0, 0, 0, 0);
  const todayStartMs = todayStart.getTime();
  const endMs = new Date(end).getTime();
  let t = new Date(start).getTime();
  if (!Number.isFinite(t) || !Number.isFinite(endMs) || t > endMs) return [];

  const stepAt = (ms) => (ms >= todayStartMs ? 10_000 : 300_000);
  t = Math.floor(t / stepAt(t)) * stepAt(t);

  const timestamps = [];
  // Bảo vệ vòng lặp nếu step lỗi
  let guard = 0;
  while (t <= endMs && guard < 500_000) {
    timestamps.push(new Date(t));
    t += stepAt(t);
    guard += 1;
  }
  return timestamps;
}

/**
 * Biểu đồ công suất / dòng điện — forward-fill theo mẫu telemetry.
 * intervalSeconds: số giây đều, hoặc 'adaptive' (hôm nay 10s / ngày cũ 5 phút).
 * livePower / liveCurrent: giá trị hiện tại (điểm cuối cửa sổ, chỉ khi live).
 */
export function buildPowerCurrentTimelineChart(
  rawMachineData,
  effectiveFrom,
  effectiveTo,
  intervalSeconds = 10,
  livePower = null,
  liveCurrent = null,
) {
  const adaptive = intervalSeconds === 'adaptive';
  const intervalMs = adaptive
    ? 10_000
    : Math.max(1000, Number(intervalSeconds) * 1000 || 1000);

  const toDate = new Date(effectiveTo);
  const fromDate = new Date(effectiveFrom);
  const fromMs = fromDate.getTime();
  const toMs = toDate.getTime();

  const allSorted = (Array.isArray(rawMachineData) ? rawMachineData : [])
    .filter((d) => d?.timestamp)
    .map((d) => ({ ...d, _ts: new Date(d.timestamp).getTime() }))
    .filter((d) => Number.isFinite(d._ts))
    .sort((a, b) => a._ts - b._ts);

  const toPower = (row) => {
    const v = Number(row?.power);
    return Number.isFinite(v) ? v : null;
  };
  const toCurrent = (row) => {
    const v = Number(row?.avg_a ?? row?.current);
    return Number.isFinite(v) ? v : null;
  };

  let lastPower = null;
  let lastCurrent = null;

  for (const d of allSorted) {
    if (d._ts >= fromMs) break;
    const p = toPower(d);
    const c = toCurrent(d);
    if (p != null) lastPower = p;
    if (c != null) lastCurrent = c;
  }

  const rangeFiltered = allSorted.filter((d) => d._ts >= fromMs && d._ts <= toMs);

  const rangeTimestamps = adaptive
    ? generateAdaptivePowerTimestamps(fromDate, toDate, toDate)
    : (() => {
        const alignedTo = alignToIntervalMs(toDate, intervalMs, 'floor');
        const windowMs = Math.max(0, toMs - fromMs);
        const alignedFrom = alignToIntervalMs(
          new Date(alignedTo.getTime() - windowMs),
          intervalMs,
          'floor',
        );
        return generateTimestampsInRangeMs(alignedFrom, alignedTo, intervalMs);
      })();

  let ptr = 0;
  const power = [];
  const current = [];

  rangeTimestamps.forEach((t) => {
    const tMs = t.getTime();
    while (ptr < rangeFiltered.length && rangeFiltered[ptr]._ts <= tMs) {
      const p = toPower(rangeFiltered[ptr]);
      const c = toCurrent(rangeFiltered[ptr]);
      if (p != null) lastPower = p;
      if (c != null) lastCurrent = c;
      ptr += 1;
    }
    power.push(lastPower);
    current.push(lastCurrent);
  });

  if (power.length > 0) {
    if (Number.isFinite(Number(livePower))) power[power.length - 1] = Number(livePower);
    if (Number.isFinite(Number(liveCurrent))) current[current.length - 1] = Number(liveCurrent);
  }

  const spanDays = (toMs - fromMs) / (24 * 60 * 60 * 1000);
  const labels = rangeTimestamps.map((t) =>
    spanDays > 1.05
      ? t.toLocaleString('vi-VN', {
          day: '2-digit',
          month: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })
      : t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  );
  const timestamps = rangeTimestamps.map((t) => t.getTime());

  return { labels, timestamps, power, current };
}
