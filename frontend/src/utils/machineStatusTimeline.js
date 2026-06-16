const STATUS_MATCH_MS = 1000 * 60 * 2.5;

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
 * Gom dữ liệu trạng thái 24h cho biểu đồ — O(n + m), không find() lồng nhau.
 */
export function buildStatusTimelineChart(rawMachineData, effectiveFrom, effectiveTo, intervalMinutes = 5) {
  const fromMs = effectiveFrom.getTime();
  const toMs = effectiveTo.getTime();

  const rangeFiltered = rawMachineData
    .filter((d) => {
      if (!d?.timestamp) return false;
      const ts = new Date(d.timestamp).getTime();
      return ts >= fromMs && ts <= toMs;
    })
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

  const rangeTimestamps = generateTimestampsInRange(effectiveFrom, effectiveTo, intervalMinutes);
  const mappedData = new Array(rangeTimestamps.length);
  let j = 0;

  for (let i = 0; i < rangeTimestamps.length; i += 1) {
    const tMs = rangeTimestamps[i].getTime();

    while (j + 1 < rangeFiltered.length) {
      const curMs = new Date(rangeFiltered[j].timestamp).getTime();
      const nextMs = new Date(rangeFiltered[j + 1].timestamp).getTime();
      if (Math.abs(nextMs - tMs) < Math.abs(curMs - tMs)) {
        j += 1;
      } else {
        break;
      }
    }

    if (rangeFiltered.length === 0) {
      mappedData[i] = null;
      continue;
    }

    const nearestMs = new Date(rangeFiltered[j].timestamp).getTime();
    mappedData[i] = Math.abs(nearestMs - tMs) < STATUS_MATCH_MS ? rangeFiltered[j].status : null;
  }

  const labels = rangeTimestamps.map((t) =>
    t.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
  );

  return { labels, mappedData };
}
