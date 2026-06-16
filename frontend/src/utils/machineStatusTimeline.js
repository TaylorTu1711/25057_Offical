import { normalizeMachineStatus, toStatusChartValue } from './machineStatus';

export function generateTimestampsInRange(start, end, intervalMinutes = 5) {
  const timestamps = [];
  const current = new Date(start);
  while (current <= end) {
    timestamps.push(new Date(current));
    current.setMinutes(current.getMinutes() + intervalMinutes);
  }
  return timestamps;
}

/**
 * Biểu đồ trạng thái 24h — giữ trạng thái cuối (forward-fill), không cần khớp ±2.5 phút.
 */
export function buildStatusTimelineChart(
  rawMachineData,
  effectiveFrom,
  effectiveTo,
  intervalMinutes = 5,
  currentStatus = null,
) {
  const fromMs = effectiveFrom.getTime();
  const toMs = effectiveTo.getTime();

  const allSorted = (Array.isArray(rawMachineData) ? rawMachineData : [])
    .filter((d) => d?.timestamp)
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  let lastStatus = toStatusChartValue(currentStatus);

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

  const rangeTimestamps = generateTimestampsInRange(effectiveFrom, effectiveTo, intervalMinutes);
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

  const labels = rangeTimestamps.map((t) =>
    t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  );

  return { labels, mappedData };
}
