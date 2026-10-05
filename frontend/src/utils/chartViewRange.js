export const CHART_VIEW_MODES = {
  hour: 'hour',
  day: 'day',
  week: 'week',
  month: 'month',
  quarter: 'quarter',
  year: 'year',
  range: 'range',
};

export const CHART_VIEW_MODE_LABELS = {
  [CHART_VIEW_MODES.hour]: 'Chọn ngày — xem theo giờ',
  [CHART_VIEW_MODES.day]: 'Chọn tháng — xem theo ngày',
  [CHART_VIEW_MODES.week]: 'Chọn tháng — xem theo tuần',
  [CHART_VIEW_MODES.month]: 'Chọn năm — xem theo tháng',
  [CHART_VIEW_MODES.quarter]: 'Chọn năm — xem theo quý',
  [CHART_VIEW_MODES.year]: 'Xem tổng hợp theo từng năm',
  [CHART_VIEW_MODES.range]: 'Khoảng thời gian',
};

/** Cách gom dữ liệu trong chế độ khoảng thời gian */
export const RANGE_DISPLAY_MODES = {
  day: 'day',
  month: 'month',
};

export const RANGE_DISPLAY_LABELS = {
  [RANGE_DISPLAY_MODES.day]: 'Theo ngày',
  [RANGE_DISPLAY_MODES.month]: 'Theo tháng',
};

/** Khóa ngày theo giờ local */
export const toLocalDateKey = (input) => {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const endOfDay = (date) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

export const startOfDay = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

export const getDefaultRangeDates = (reference = new Date()) => {
  const to = startOfDay(reference);
  const from = new Date(to.getFullYear(), to.getMonth(), 1);
  return { from, to };
};

export const getDaysInRange = (from, to) => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (start > end) return [];

  const days = [];
  const cur = new Date(start);
  while (cur <= end) {
    days.push(new Date(cur));
    cur.setDate(cur.getDate() + 1);
  }
  return days;
};

const formatDateVi = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
};

const formatRangeDayLabel = (date, totalDays) => {
  if (totalDays <= 31) return String(date.getDate());
  if (totalDays <= 120) return `${date.getDate()}/${date.getMonth() + 1}`;
  return formatDateVi(date);
};

export const getMonthsInRange = (from, to) => {
  const start = startOfDay(from);
  const end = startOfDay(to);
  if (start > end) return [];

  const months = [];
  const cur = new Date(start.getFullYear(), start.getMonth(), 1);
  const endAnchor = new Date(end.getFullYear(), end.getMonth(), 1);

  while (cur <= endAnchor) {
    months.push({
      key: `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`,
      year: cur.getFullYear(),
      month: cur.getMonth() + 1,
      monthIndex: cur.getMonth(),
    });
    cur.setMonth(cur.getMonth() + 1);
  }

  return months;
};

const formatRangeMonthLabel = (monthInfo, spansMultipleYears) => {
  if (spansMultipleYears) return `${monthInfo.month}/${monthInfo.year}`;
  return `T${monthInfo.month}`;
};

const countDaysInRangeMonth = (from, to, year, monthIndex0) => {
  const monthStart = startOfDay(new Date(year, monthIndex0, 1));
  const monthEnd = startOfDay(new Date(year, monthIndex0 + 1, 0));
  const rangeStart = startOfDay(from);
  const rangeEnd = startOfDay(to);
  const effectiveStart = monthStart > rangeStart ? monthStart : rangeStart;
  const effectiveEnd = monthEnd < rangeEnd ? monthEnd : rangeEnd;
  if (effectiveStart > effectiveEnd) return 0;
  return getDaysInRange(effectiveStart, effectiveEnd).length;
};

const isRangeByMonth = (selection) =>
  selection.rangeDisplay === RANGE_DISPLAY_MODES.month;

export const getDaysInMonth = (year, monthIndex0) => {
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const days = [];
  for (let day = 1; day <= lastDay; day += 1) {
    days.push(new Date(year, monthIndex0, day));
  }
  return days;
};

export const getMonthKeysInYear = (year) =>
  Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);

/** Các tuần trong tháng (ngày 1–7 = T1, 8–14 = T2, …). */
export const getWeeksInMonth = (year, monthIndex0) => {
  const days = getDaysInMonth(year, monthIndex0);
  if (days.length === 0) return [];
  const weekCount = Math.ceil(days.length / 7);
  const weeks = [];
  for (let w = 0; w < weekCount; w += 1) {
    const slice = days.slice(w * 7, w * 7 + 7);
    weeks.push({
      key: `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-W${w + 1}`,
      label: `T${w + 1}`,
      weekIndex: w + 1,
      days: slice,
      from: startOfDay(slice[0]),
      to: endOfDay(slice[slice.length - 1]),
      dayCount: slice.length,
    });
  }
  return weeks;
};

export const getQuartersInYear = (year) =>
  [1, 2, 3, 4].map((q) => {
    const startMonth = (q - 1) * 3;
    return {
      key: `${year}-Q${q}`,
      label: `Q${q}`,
      quarter: q,
      from: new Date(year, startMonth, 1),
      to: endOfDay(new Date(year, startMonth + 3, 0)),
      monthIndexes: [startMonth, startMonth + 1, startMonth + 2],
      dayCount: getDaysInRange(
        new Date(year, startMonth, 1),
        new Date(year, startMonth + 3, 0),
      ).length,
    };
  });

/**
 * Gom telemetry thô theo giờ trong một ngày (delta time_on / time_running / kWh).
 * @returns {Record<string, { time_on: number, time_running: number, power_consumption: number, product: number }>}
 */
export function aggregateTelemetryByHour(rawRows = [], dayDate) {
  const dayStart = startOfDay(dayDate);
  const dayEnd = endOfDay(dayDate);
  const samples = (Array.isArray(rawRows) ? rawRows : [])
    .filter((d) => d?.timestamp)
    .map((d) => ({ ...d, _ts: new Date(d.timestamp).getTime() }))
    .filter((d) => Number.isFinite(d._ts) && d._ts >= dayStart.getTime() && d._ts <= dayEnd.getTime())
    .sort((a, b) => a._ts - b._ts);

  const byHour = {};
  for (let h = 0; h < 24; h += 1) {
    const key = `${toLocalDateKey(dayStart)}T${String(h).padStart(2, '0')}`;
    byHour[key] = { time_on: 0, time_running: 0, power_consumption: 0, product: 0 };
  }

  if (samples.length === 0) return byHour;

  const hourBuckets = Array.from({ length: 24 }, () => []);
  samples.forEach((s) => {
    hourBuckets[new Date(s._ts).getHours()].push(s);
  });

  let prevClose = null;
  // Seed: mẫu cuối trước ngày (nếu có trong rawRows)
  const before = (Array.isArray(rawRows) ? rawRows : [])
    .filter((d) => d?.timestamp && new Date(d.timestamp).getTime() < dayStart.getTime())
    .sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  if (before.length > 0) prevClose = before[before.length - 1];

  for (let h = 0; h < 24; h += 1) {
    const bucket = hourBuckets[h];
    if (bucket.length === 0) continue;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const baseOn = Number(prevClose?.time_on ?? first.time_on) || 0;
    const baseRun = Number(prevClose?.time_running ?? first.time_running) || 0;
    const baseEnergy = Number(prevClose?.power_consumption ?? first.power_consumption) || 0;
    const baseProduct = Number(prevClose?.product ?? first.product) || 0;

    const endOn = Number(last.time_on) || 0;
    const endRun = Number(last.time_running) || 0;
    const endEnergy = Number(last.power_consumption) || 0;
    const endProduct = Number(last.product) || 0;

    const key = `${toLocalDateKey(dayStart)}T${String(h).padStart(2, '0')}`;
    byHour[key] = {
      time_on: Math.max(0, endOn - baseOn),
      time_running: Math.max(0, endRun - baseRun),
      power_consumption: Math.max(0, endEnergy - baseEnergy),
      product: Math.max(0, endProduct - baseProduct),
    };
    prevClose = last;
  }

  return byHour;
}

export const getYearKeysFromData = (rawData = [], errors = [], reference = new Date()) => {
  const years = new Set([reference.getFullYear()]);

  rawData.forEach((row) => {
    if (row?.timestamp) years.add(new Date(row.timestamp).getFullYear());
  });

  errors.forEach((row) => {
    if (row?.timestamp) years.add(new Date(row.timestamp).getFullYear());
  });

  const sorted = [...years].sort((a, b) => a - b);
  return sorted.length > 0 ? sorted : [reference.getFullYear()];
};

/** @param {{ year: number, month: number, day?: number }} selection month: 1–12 */
export const getChartViewPeriodLabel = (viewMode, selection = {}) => {
  const {
    year = new Date().getFullYear(),
    month = new Date().getMonth() + 1,
    day = new Date().getDate(),
  } = selection;
  switch (viewMode) {
    case CHART_VIEW_MODES.hour:
      return `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/${year}`;
    case CHART_VIEW_MODES.day:
    case CHART_VIEW_MODES.week:
      return `Tháng ${month}/${year}`;
    case CHART_VIEW_MODES.month:
    case CHART_VIEW_MODES.quarter:
      return `Năm ${year}`;
    case CHART_VIEW_MODES.range: {
      const { from, to } = getSelectionRange(viewMode, selection);
      const granularity = isRangeByMonth(selection)
        ? RANGE_DISPLAY_LABELS[RANGE_DISPLAY_MODES.month]
        : RANGE_DISPLAY_LABELS[RANGE_DISPLAY_MODES.day];
      return `${formatDateVi(from)} – ${formatDateVi(to)} (${granularity})`;
    }
    case CHART_VIEW_MODES.year:
    default:
      return 'Theo từng năm';
  }
};

const formatDayLabel = (date) => String(date.getDate());

const formatHourLabel = (hour) => `${String(hour).padStart(2, '0')}h`;

const formatMonthLabel = (monthKey) => {
  const [, month] = monthKey.split('-');
  return `T${parseInt(month, 10)}`;
};

const formatYearLabel = (year) => String(year);

const filterInRange = (rows, from, to, timestampKey = 'timestamp') =>
  rows.filter((row) => {
    if (!row?.[timestampKey]) return false;
    const ts = new Date(row[timestampKey]);
    if (from && ts < from) return false;
    if (to && ts > to) return false;
    return true;
  });

const calcPerformancePct = (hours, bucketDays) =>
  Math.min(100, Number(((hours / (bucketDays * 24)) * 100).toFixed(1)));

/** Năng suất thực tế (tấn/giờ) = sản lượng ÷ thời gian chạy (giờ); không có giờ chạy → 0. */
const calcOutputRateTonsPerHour = (outputTons, hours) => {
  const h = Number(hours);
  if (!h || h <= 0) return 0;
  const out = Number(outputTons) || 0;
  return Number((out / h).toFixed(2));
};

const getSelectionRange = (viewMode, selection = {}) => {
  const now = new Date();
  const year = selection.year ?? now.getFullYear();
  const month = selection.month ?? now.getMonth() + 1;
  const day = selection.day ?? now.getDate();

  if (viewMode === CHART_VIEW_MODES.hour) {
    const monthIndex = month - 1;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const safeDay = Math.min(Math.max(1, day), daysInMonth);
    return {
      from: new Date(year, monthIndex, safeDay, 0, 0, 0, 0),
      to: endOfDay(new Date(year, monthIndex, safeDay)),
      year,
      month,
      day: safeDay,
    };
  }

  if (viewMode === CHART_VIEW_MODES.day || viewMode === CHART_VIEW_MODES.week) {
    const monthIndex = month - 1;
    return {
      from: new Date(year, monthIndex, 1),
      to: endOfDay(new Date(year, monthIndex + 1, 0)),
      year,
      month,
    };
  }

  if (
    viewMode === CHART_VIEW_MODES.month
    || viewMode === CHART_VIEW_MODES.quarter
  ) {
    return {
      from: new Date(year, 0, 1),
      to: endOfDay(new Date(year, 11, 31)),
      year,
    };
  }

  if (viewMode === CHART_VIEW_MODES.range) {
    const defaults = getDefaultRangeDates(now);
    let from = startOfDay(selection.dateFrom ?? defaults.from);
    let to = endOfDay(selection.dateTo ?? defaults.to);
    if (from > to) {
      const swap = from;
      from = startOfDay(to);
      to = endOfDay(swap);
    }
    return { from, to };
  }

  const years = selection.availableYears ?? [year];
  const minYear = years[0] ?? year;
  return {
    from: new Date(minYear, 0, 1),
    to: endOfDay(now),
    years,
  };
};

export function buildProductivitySeries(rawData, viewMode, selection = {}) {
  if (viewMode === CHART_VIEW_MODES.day) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const days = getDaysInMonth(year, month - 1);
    const outputMap = {};
    const inputMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      outputMap[key] = row.product ?? 0;
      inputMap[key] = row.input_material ?? 0;
    });

    return {
      labels: days.map(formatDayLabel),
      output: days.map((d) => outputMap[toLocalDateKey(d)] ?? 0),
      input: days.map((d) => inputMap[toLocalDateKey(d)] ?? 0),
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const monthKeys = getMonthKeysInYear(year);
    const outputMap = {};
    const inputMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      outputMap[key] = (outputMap[key] || 0) + (row.product ?? 0);
      inputMap[key] = (inputMap[key] || 0) + (row.input_material ?? 0);
    });

    return {
      labels: monthKeys.map(formatMonthLabel),
      output: monthKeys.map((key) => outputMap[key] ?? 0),
      input: monthKeys.map((key) => inputMap[key] ?? 0),
    };
  }

  if (viewMode === CHART_VIEW_MODES.range) {
    const { from, to } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);

    if (isRangeByMonth(selection)) {
      const months = getMonthsInRange(from, to);
      const spansMultipleYears = new Set(months.map((m) => m.year)).size > 1;
      const outputMap = {};
      const inputMap = {};

      filtered.forEach((row) => {
        const ts = new Date(row.timestamp);
        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        outputMap[key] = (outputMap[key] || 0) + (row.product ?? 0);
        inputMap[key] = (inputMap[key] || 0) + (row.input_material ?? 0);
      });

      return {
        labels: months.map((m) => formatRangeMonthLabel(m, spansMultipleYears)),
        output: months.map((m) => outputMap[m.key] ?? 0),
        input: months.map((m) => inputMap[m.key] ?? 0),
      };
    }

    const days = getDaysInRange(from, to);
    const outputMap = {};
    const inputMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      outputMap[key] = row.product ?? 0;
      inputMap[key] = row.input_material ?? 0;
    });

    return {
      labels: days.map((d) => formatRangeDayLabel(d, days.length)),
      output: days.map((d) => outputMap[toLocalDateKey(d)] ?? 0),
      input: days.map((d) => inputMap[toLocalDateKey(d)] ?? 0),
    };
  }

  const { from, to } = getSelectionRange(viewMode, selection);
  const years = getYearKeysFromData(rawData, [], new Date());
  const filtered = filterInRange(rawData, from, to);
  const outputMap = {};
  const inputMap = {};

  filtered.forEach((row) => {
    const y = new Date(row.timestamp).getFullYear();
    outputMap[y] = (outputMap[y] || 0) + (row.product ?? 0);
    inputMap[y] = (inputMap[y] || 0) + (row.input_material ?? 0);
  });

  return {
    labels: years.map(formatYearLabel),
    output: years.map((y) => outputMap[y] ?? 0),
    input: years.map((y) => inputMap[y] ?? 0),
  };
}

export function buildTimeSeries(rawData, viewMode, selection = {}) {
  const rowEnergyKwh = (row) => Number(row.power_consumption ?? row.shoot ?? 0) || 0;
  /** Giờ chạy trong bucket: ưu tiên time_running (CNC), fallback time_on. */
  const rowRunHours = (row) =>
    (Number(row.time_running ?? row.time_on ?? 0) || 0) / 3600;

  if (viewMode === CHART_VIEW_MODES.hour) {
    const { from, year, month, day } = getSelectionRange(viewMode, selection);
    const hourMap = aggregateTelemetryByHour(
      selection.telemetryRows ?? rawData,
      from,
    );
    const hours = Array.from({ length: 24 }, (_, h) => h);
    return {
      labels: hours.map(formatHourLabel),
      timeRun: hours.map((h) => {
        const key = `${toLocalDateKey(new Date(year, month - 1, day))}T${String(h).padStart(2, '0')}`;
        return (Number(hourMap[key]?.time_running) || 0) / 3600;
      }),
      energyKwh: hours.map((h) => {
        const key = `${toLocalDateKey(new Date(year, month - 1, day))}T${String(h).padStart(2, '0')}`;
        return Number(hourMap[key]?.power_consumption) || 0;
      }),
      performance: hours.map((h) => {
        const key = `${toLocalDateKey(new Date(year, month - 1, day))}T${String(h).padStart(2, '0')}`;
        const runH = (Number(hourMap[key]?.time_running) || 0) / 3600;
        return Math.min(100, Number((runH * 100).toFixed(1)));
      }),
      outputRate: hours.map((h) => {
        const key = `${toLocalDateKey(new Date(year, month - 1, day))}T${String(h).padStart(2, '0')}`;
        const runH = (Number(hourMap[key]?.time_running) || 0) / 3600;
        return calcOutputRateTonsPerHour(hourMap[key]?.product ?? 0, runH);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.day) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const days = getDaysInMonth(year, month - 1);
    const timeMap = {};
    const energyMap = {};
    const outputMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      timeMap[key] = rowRunHours(row);
      energyMap[key] = rowEnergyKwh(row);
      outputMap[key] = row.product ?? 0;
    });

    return {
      labels: days.map(formatDayLabel),
      timeRun: days.map((d) => timeMap[toLocalDateKey(d)] ?? 0),
      energyKwh: days.map((d) => energyMap[toLocalDateKey(d)] ?? 0),
      performance: days.map((d) => calcPerformancePct(timeMap[toLocalDateKey(d)] ?? 0, 1)),
      outputRate: days.map((d) => {
        const key = toLocalDateKey(d);
        return calcOutputRateTonsPerHour(outputMap[key] ?? 0, timeMap[key] ?? 0);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.week) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const weeks = getWeeksInMonth(year, month - 1);
    const timeMap = {};
    const energyMap = {};
    const outputMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      timeMap[key] = rowRunHours(row);
      energyMap[key] = rowEnergyKwh(row);
      outputMap[key] = row.product ?? 0;
    });

    return {
      labels: weeks.map((w) => w.label),
      timeRun: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (timeMap[toLocalDateKey(d)] ?? 0), 0),
      ),
      energyKwh: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (energyMap[toLocalDateKey(d)] ?? 0), 0),
      ),
      performance: weeks.map((w) => {
        const hours = w.days.reduce((sum, d) => sum + (timeMap[toLocalDateKey(d)] ?? 0), 0);
        return calcPerformancePct(hours, w.dayCount);
      }),
      outputRate: weeks.map((w) => {
        const hours = w.days.reduce((sum, d) => sum + (timeMap[toLocalDateKey(d)] ?? 0), 0);
        const out = w.days.reduce((sum, d) => sum + (outputMap[toLocalDateKey(d)] ?? 0), 0);
        return calcOutputRateTonsPerHour(out, hours);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const monthKeys = getMonthKeysInYear(year);
    const timeMap = {};
    const energyMap = {};
    const outputMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      timeMap[key] = (timeMap[key] || 0) + rowRunHours(row);
      energyMap[key] = (energyMap[key] || 0) + rowEnergyKwh(row);
      outputMap[key] = (outputMap[key] || 0) + (row.product ?? 0);
    });

    return {
      labels: monthKeys.map(formatMonthLabel),
      timeRun: monthKeys.map((key) => timeMap[key] ?? 0),
      energyKwh: monthKeys.map((key) => energyMap[key] ?? 0),
      performance: monthKeys.map((key) => {
        const [, m] = key.split('-');
        const daysInMonth = new Date(year, parseInt(m, 10), 0).getDate();
        return calcPerformancePct(timeMap[key] ?? 0, daysInMonth);
      }),
      outputRate: monthKeys.map((key) =>
        calcOutputRateTonsPerHour(outputMap[key] ?? 0, timeMap[key] ?? 0),
      ),
    };
  }

  if (viewMode === CHART_VIEW_MODES.quarter) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const quarters = getQuartersInYear(year);
    const timeMap = {};
    const energyMap = {};
    const outputMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const q = Math.floor(ts.getMonth() / 3) + 1;
      const key = `${ts.getFullYear()}-Q${q}`;
      timeMap[key] = (timeMap[key] || 0) + rowRunHours(row);
      energyMap[key] = (energyMap[key] || 0) + rowEnergyKwh(row);
      outputMap[key] = (outputMap[key] || 0) + (row.product ?? 0);
    });

    return {
      labels: quarters.map((q) => q.label),
      timeRun: quarters.map((q) => timeMap[q.key] ?? 0),
      energyKwh: quarters.map((q) => energyMap[q.key] ?? 0),
      performance: quarters.map((q) =>
        calcPerformancePct(timeMap[q.key] ?? 0, q.dayCount),
      ),
      outputRate: quarters.map((q) =>
        calcOutputRateTonsPerHour(outputMap[q.key] ?? 0, timeMap[q.key] ?? 0),
      ),
    };
  }

  if (viewMode === CHART_VIEW_MODES.range) {
    const { from, to } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);

    if (isRangeByMonth(selection)) {
      const months = getMonthsInRange(from, to);
      const spansMultipleYears = new Set(months.map((m) => m.year)).size > 1;
      const timeMap = {};
      const energyMap = {};
      const outputMap = {};

      filtered.forEach((row) => {
        const ts = new Date(row.timestamp);
        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        timeMap[key] = (timeMap[key] || 0) + rowRunHours(row);
        energyMap[key] = (energyMap[key] || 0) + rowEnergyKwh(row);
        outputMap[key] = (outputMap[key] || 0) + (row.product ?? 0);
      });

      return {
        labels: months.map((m) => formatRangeMonthLabel(m, spansMultipleYears)),
        timeRun: months.map((m) => timeMap[m.key] ?? 0),
        energyKwh: months.map((m) => energyMap[m.key] ?? 0),
        performance: months.map((m) =>
          calcPerformancePct(
            timeMap[m.key] ?? 0,
            countDaysInRangeMonth(from, to, m.year, m.monthIndex),
          ),
        ),
        outputRate: months.map((m) =>
          calcOutputRateTonsPerHour(outputMap[m.key] ?? 0, timeMap[m.key] ?? 0),
        ),
      };
    }

    const days = getDaysInRange(from, to);
    const timeMap = {};
    const energyMap = {};
    const outputMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      timeMap[key] = rowRunHours(row);
      energyMap[key] = rowEnergyKwh(row);
      outputMap[key] = row.product ?? 0;
    });

    return {
      labels: days.map((d) => formatRangeDayLabel(d, days.length)),
      timeRun: days.map((d) => timeMap[toLocalDateKey(d)] ?? 0),
      energyKwh: days.map((d) => energyMap[toLocalDateKey(d)] ?? 0),
      performance: days.map((d) => calcPerformancePct(timeMap[toLocalDateKey(d)] ?? 0, 1)),
      outputRate: days.map((d) => {
        const key = toLocalDateKey(d);
        return calcOutputRateTonsPerHour(outputMap[key] ?? 0, timeMap[key] ?? 0);
      }),
    };
  }

  const { from, to } = getSelectionRange(viewMode, selection);
  const years = getYearKeysFromData(rawData, [], new Date());
  const filtered = filterInRange(rawData, from, to);
  const timeMap = {};
  const energyMap = {};
  const outputMap = {};

  filtered.forEach((row) => {
    const y = new Date(row.timestamp).getFullYear();
    timeMap[y] = (timeMap[y] || 0) + rowRunHours(row);
    energyMap[y] = (energyMap[y] || 0) + rowEnergyKwh(row);
    outputMap[y] = (outputMap[y] || 0) + (row.product ?? 0);
  });

  return {
    labels: years.map(formatYearLabel),
    timeRun: years.map((y) => timeMap[y] ?? 0),
    energyKwh: years.map((y) => energyMap[y] ?? 0),
    performance: years.map((y) => {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return calcPerformancePct(timeMap[y] ?? 0, isLeap ? 366 : 365);
    }),
    outputRate: years.map((y) =>
      calcOutputRateTonsPerHour(outputMap[y] ?? 0, timeMap[y] ?? 0),
    ),
  };
}

const clampEffPct = (value) => Math.min(100, Math.max(0, Number(value.toFixed(1))));

const SEC_PER_DAY = 24 * 3600;

/** Hiệu suất vận hành % = thời gian chạy / thời gian bật máy (null nếu không bật máy). */
const calcUtilizationPct = (runSec, onSec) => {
  const on = Number(onSec) || 0;
  if (on <= 0) return null;
  return clampEffPct(((Number(runSec) || 0) / on) * 100);
};

/** Hiệu suất sử dụng theo ngày % = thời gian chạy / 24h. */
const calcUsagePctPerDay = (runSec) =>
  clampEffPct(((Number(runSec) || 0) / SEC_PER_DAY) * 100);

/**
 * Biểu đồ hiệu suất theo ngày/tháng/năm (cùng bộ chọn với thời gian & điện năng).
 * Theo ngày:
 * - vận hành = time_running / time_on trong ngày
 * - sử dụng = time_running / 24h
 * Theo tháng:
 * - vận hành = time_running / time_on trong tháng
 * - sử dụng = time_running / (số ngày trong tháng × 24h)
 * Theo năm: cộng dồn tương tự (sử dụng ÷ số ngày năm × 24h).
 */
export function buildEfficiencySeries(rawData, viewMode, selection = {}) {
  const rowRunSec = (row) => Number(row.time_running) || 0;
  const rowOnSec = (row) => Number(row.time_on) || 0;

  if (viewMode === CHART_VIEW_MODES.hour) {
    const { from, year, month, day } = getSelectionRange(viewMode, selection);
    const hourMap = aggregateTelemetryByHour(
      selection.telemetryRows ?? rawData,
      from,
    );
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const dayKey = toLocalDateKey(new Date(year, month - 1, day));
    return {
      labels: hours.map(formatHourLabel),
      utilization: hours.map((h) => {
        const key = `${dayKey}T${String(h).padStart(2, '0')}`;
        return calcUtilizationPct(hourMap[key]?.time_running, hourMap[key]?.time_on);
      }),
      usage: hours.map((h) => {
        const key = `${dayKey}T${String(h).padStart(2, '0')}`;
        return clampEffPct(((Number(hourMap[key]?.time_running) || 0) / 3600) * 100);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.day) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const days = getDaysInMonth(year, month - 1);
    const runMap = {};
    const onMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
    });

    return {
      labels: days.map(formatDayLabel),
      utilization: days.map((d) => {
        const key = toLocalDateKey(d);
        return calcUtilizationPct(runMap[key], onMap[key]);
      }),
      usage: days.map((d) => calcUsagePctPerDay(runMap[toLocalDateKey(d)] ?? 0)),
    };
  }

  if (viewMode === CHART_VIEW_MODES.week) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const weeks = getWeeksInMonth(year, month - 1);
    const runMap = {};
    const onMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
    });

    return {
      labels: weeks.map((w) => w.label),
      utilization: weeks.map((w) => {
        const run = w.days.reduce((sum, d) => sum + (runMap[toLocalDateKey(d)] ?? 0), 0);
        const on = w.days.reduce((sum, d) => sum + (onMap[toLocalDateKey(d)] ?? 0), 0);
        return calcUtilizationPct(run, on);
      }),
      usage: weeks.map((w) => {
        const run = w.days.reduce((sum, d) => sum + (runMap[toLocalDateKey(d)] ?? 0), 0);
        return clampEffPct((run / (w.dayCount * SEC_PER_DAY)) * 100);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const monthKeys = getMonthKeysInYear(year);
    const runMap = {};
    const onMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      runMap[key] = (runMap[key] || 0) + rowRunSec(row);
      onMap[key] = (onMap[key] || 0) + rowOnSec(row);
    });

    return {
      labels: monthKeys.map(formatMonthLabel),
      utilization: monthKeys.map((key) => calcUtilizationPct(runMap[key], onMap[key])),
      usage: monthKeys.map((key) => {
        const [, m] = key.split('-');
        const daysInMonth = new Date(year, parseInt(m, 10), 0).getDate();
        return clampEffPct(((runMap[key] ?? 0) / (daysInMonth * SEC_PER_DAY)) * 100);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.quarter) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const quarters = getQuartersInYear(year);
    const runMap = {};
    const onMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const q = Math.floor(ts.getMonth() / 3) + 1;
      const key = `${ts.getFullYear()}-Q${q}`;
      runMap[key] = (runMap[key] || 0) + rowRunSec(row);
      onMap[key] = (onMap[key] || 0) + rowOnSec(row);
    });

    return {
      labels: quarters.map((q) => q.label),
      utilization: quarters.map((q) => calcUtilizationPct(runMap[q.key], onMap[q.key])),
      usage: quarters.map((q) =>
        clampEffPct(((runMap[q.key] ?? 0) / (q.dayCount * SEC_PER_DAY)) * 100),
      ),
    };
  }

  if (viewMode === CHART_VIEW_MODES.range) {
    const { from, to } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);

    if (isRangeByMonth(selection)) {
      const months = getMonthsInRange(from, to);
      const spansMultipleYears = new Set(months.map((m) => m.year)).size > 1;
      const runMap = {};
      const onMap = {};

      filtered.forEach((row) => {
        const ts = new Date(row.timestamp);
        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        runMap[key] = (runMap[key] || 0) + rowRunSec(row);
        onMap[key] = (onMap[key] || 0) + rowOnSec(row);
      });

      return {
        labels: months.map((m) => formatRangeMonthLabel(m, spansMultipleYears)),
        utilization: months.map((m) => calcUtilizationPct(runMap[m.key], onMap[m.key])),
        usage: months.map((m) => {
          const days = countDaysInRangeMonth(from, to, m.year, m.monthIndex);
          if (days <= 0) return 0;
          return clampEffPct(((runMap[m.key] ?? 0) / (days * SEC_PER_DAY)) * 100);
        }),
      };
    }

    const days = getDaysInRange(from, to);
    const runMap = {};
    const onMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
    });

    return {
      labels: days.map((d) => formatRangeDayLabel(d, days.length)),
      utilization: days.map((d) => {
        const key = toLocalDateKey(d);
        return calcUtilizationPct(runMap[key], onMap[key]);
      }),
      usage: days.map((d) => calcUsagePctPerDay(runMap[toLocalDateKey(d)] ?? 0)),
    };
  }

  const { from, to } = getSelectionRange(viewMode, selection);
  const years = getYearKeysFromData(rawData, [], new Date());
  const filtered = filterInRange(rawData, from, to);
  const runMap = {};
  const onMap = {};

  filtered.forEach((row) => {
    const y = new Date(row.timestamp).getFullYear();
    runMap[y] = (runMap[y] || 0) + rowRunSec(row);
    onMap[y] = (onMap[y] || 0) + rowOnSec(row);
  });

  return {
    labels: years.map(formatYearLabel),
    utilization: years.map((y) => calcUtilizationPct(runMap[y], onMap[y])),
    usage: years.map((y) => {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      const days = isLeap ? 366 : 365;
      return clampEffPct(((runMap[y] ?? 0) / (days * SEC_PER_DAY)) * 100);
    }),
  };
}

export function buildErrorSeries(allErrors, viewMode, selection = {}) {
  if (viewMode === CHART_VIEW_MODES.day) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(allErrors || [], from, to);
    const days = getDaysInMonth(year, month - 1);
    const countMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      countMap[key] = (countMap[key] || 0) + 1;
    });

    return {
      labels: days.map(formatDayLabel),
      values: days.map((d) => countMap[toLocalDateKey(d)] ?? 0),
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(allErrors || [], from, to);
    const monthKeys = getMonthKeysInYear(year);
    const countMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      countMap[key] = (countMap[key] || 0) + 1;
    });

    return {
      labels: monthKeys.map(formatMonthLabel),
      values: monthKeys.map((key) => countMap[key] ?? 0),
    };
  }

  if (viewMode === CHART_VIEW_MODES.range) {
    const { from, to } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(allErrors || [], from, to);

    if (isRangeByMonth(selection)) {
      const months = getMonthsInRange(from, to);
      const spansMultipleYears = new Set(months.map((m) => m.year)).size > 1;
      const countMap = {};

      filtered.forEach((row) => {
        const ts = new Date(row.timestamp);
        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        countMap[key] = (countMap[key] || 0) + 1;
      });

      return {
        labels: months.map((m) => formatRangeMonthLabel(m, spansMultipleYears)),
        values: months.map((m) => countMap[m.key] ?? 0),
      };
    }

    const days = getDaysInRange(from, to);
    const countMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      countMap[key] = (countMap[key] || 0) + 1;
    });

    return {
      labels: days.map((d) => formatRangeDayLabel(d, days.length)),
      values: days.map((d) => countMap[toLocalDateKey(d)] ?? 0),
    };
  }

  const { from, to } = getSelectionRange(viewMode, selection);
  const years = getYearKeysFromData([], allErrors || [], new Date());
  const filtered = filterInRange(allErrors || [], from, to);
  const countMap = {};

  filtered.forEach((row) => {
    const y = new Date(row.timestamp).getFullYear();
    countMap[y] = (countMap[y] || 0) + 1;
  });

  return {
    labels: years.map(formatYearLabel),
    values: years.map((y) => countMap[y] ?? 0),
  };
}

const avgBucket = (sum, count) => (count > 0 ? sum / count : 0);

const pushElectricalSample = (map, key, row) => {
  if (!map[key]) map[key] = { powerSum: 0, currentSum: 0, count: 0 };
  map[key].powerSum += Number(row.power) || 0;
  map[key].currentSum += Number(row.avg_a) || 0;
  map[key].count += 1;
};

/**
 * Trung bình công suất (kW) và dòng (A) theo chế độ xem — telemetry CNC thô.
 */
export function buildPowerCurrentSeries(rawRows = [], viewMode, selection = {}) {
  const rows = Array.isArray(rawRows) ? rawRows : [];

  if (viewMode === CHART_VIEW_MODES.day) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rows, from, to);
    const days = getDaysInMonth(year, month - 1);
    const map = {};
    filtered.forEach((row) => pushElectricalSample(map, toLocalDateKey(row.timestamp), row));
    return {
      labels: days.map(formatDayLabel),
      power: days.map((d) => {
        const b = map[toLocalDateKey(d)];
        return b ? avgBucket(b.powerSum, b.count) : 0;
      }),
      current: days.map((d) => {
        const b = map[toLocalDateKey(d)];
        return b ? avgBucket(b.currentSum, b.count) : 0;
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rows, from, to);
    const monthKeys = getMonthKeysInYear(year);
    const map = {};
    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      pushElectricalSample(map, key, row);
    });
    return {
      labels: monthKeys.map(formatMonthLabel),
      power: monthKeys.map((key) => {
        const b = map[key];
        return b ? avgBucket(b.powerSum, b.count) : 0;
      }),
      current: monthKeys.map((key) => {
        const b = map[key];
        return b ? avgBucket(b.currentSum, b.count) : 0;
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.range) {
    const { from, to } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rows, from, to);

    if (isRangeByMonth(selection)) {
      const months = getMonthsInRange(from, to);
      const spansMultipleYears = new Set(months.map((m) => m.year)).size > 1;
      const map = {};
      filtered.forEach((row) => {
        const ts = new Date(row.timestamp);
        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        pushElectricalSample(map, key, row);
      });
      return {
        labels: months.map((m) => formatRangeMonthLabel(m, spansMultipleYears)),
        power: months.map((m) => {
          const b = map[m.key];
          return b ? avgBucket(b.powerSum, b.count) : 0;
        }),
        current: months.map((m) => {
          const b = map[m.key];
          return b ? avgBucket(b.currentSum, b.count) : 0;
        }),
      };
    }

    const days = getDaysInRange(from, to);
    const map = {};
    filtered.forEach((row) => pushElectricalSample(map, toLocalDateKey(row.timestamp), row));
    return {
      labels: days.map((d) => formatRangeDayLabel(d, days.length)),
      power: days.map((d) => {
        const b = map[toLocalDateKey(d)];
        return b ? avgBucket(b.powerSum, b.count) : 0;
      }),
      current: days.map((d) => {
        const b = map[toLocalDateKey(d)];
        return b ? avgBucket(b.currentSum, b.count) : 0;
      }),
    };
  }

  const years = getYearKeysFromData(rows, [], new Date());
  const map = {};
  rows.forEach((row) => {
    const y = new Date(row.timestamp).getFullYear();
    if (!Number.isFinite(y)) return;
    pushElectricalSample(map, String(y), row);
  });
  return {
    labels: years.map(formatYearLabel),
    power: years.map((y) => {
      const b = map[String(y)];
      return b ? avgBucket(b.powerSum, b.count) : 0;
    }),
    current: years.map((y) => {
      const b = map[String(y)];
      return b ? avgBucket(b.currentSum, b.count) : 0;
    }),
  };
}

/** Nhãn loại cột cho tooltip biểu đồ theo chế độ xem. */
export function getChartCategoryPrefix(viewMode, selection = {}) {
  switch (viewMode) {
    case CHART_VIEW_MODES.hour:
      return 'Giờ';
    case CHART_VIEW_MODES.day:
      return 'Ngày';
    case CHART_VIEW_MODES.week:
      return 'Tuần';
    case CHART_VIEW_MODES.month:
      return 'Tháng';
    case CHART_VIEW_MODES.quarter:
      return 'Quý';
    case CHART_VIEW_MODES.year:
      return 'Năm';
    case CHART_VIEW_MODES.range:
      return isRangeByMonth(selection) ? 'Tháng' : 'Ngày';
    default:
      return '';
  }
}

export const toErrorChartTickMode = (viewMode, selection = {}) => {
  if (viewMode === CHART_VIEW_MODES.hour) return 'year';
  if (viewMode === CHART_VIEW_MODES.day || viewMode === CHART_VIEW_MODES.week) return 'month';
  if (viewMode === CHART_VIEW_MODES.range) {
    if (isRangeByMonth(selection)) return 'year';
    const { from, to } = getSelectionRange(viewMode, selection);
    return getDaysInRange(from, to).length > 20 ? 'month' : 'year';
  }
  return 'year';
};

/**
 * Chuỗi % / giờ Cắt gọt–Ngưng theo bucket (cùng trục X Giờ…Năm).
 * %: cắt gọt = time_running / khung thời gian bucket (1h / 24h / …) × 100;
 *     ngưng = 100 − cắt gọt.
 * Giờ: cắt gọt = time_running; ngưng = khung − cắt gọt.
 */
export function buildRunStopPctSeries(rawData, viewMode, selection = {}) {
  const buckets = buildRunStopBuckets(rawData, viewMode, selection);
  const cutPct = buckets.runSec.map((run, i) => {
    const avail = Number(buckets.availSec[i]) || 0;
    const on = Number(buckets.onSec[i]) || 0;
    const runSec = Number(run) || 0;
    // Không có dữ liệu trong bucket → để trống
    if (runSec <= 0 && on <= 0) return 0;
    if (avail <= 0) return 0;
    const pct = (runSec / avail) * 100;
    return Number(Math.min(100, Math.max(0, pct)).toFixed(1));
  });
  const stopPct = cutPct.map((cut, i) => {
    const on = Number(buckets.onSec[i]) || 0;
    const runSec = Number(buckets.runSec[i]) || 0;
    if (runSec <= 0 && on <= 0) return 0;
    return Number(Math.max(0, 100 - cut).toFixed(1));
  });
  const cutHours = buckets.runSec.map((run, i) => {
    const on = Number(buckets.onSec[i]) || 0;
    const runSec = Number(run) || 0;
    if (runSec <= 0 && on <= 0) return 0;
    return Number((runSec / 3600).toFixed(2));
  });
  const stopHours = buckets.runSec.map((run, i) => {
    const avail = Number(buckets.availSec[i]) || 0;
    const on = Number(buckets.onSec[i]) || 0;
    const runSec = Number(run) || 0;
    if (runSec <= 0 && on <= 0) return 0;
    return Number((Math.max(0, avail - runSec) / 3600).toFixed(2));
  });

  return {
    labels: buckets.labels,
    cutPct,
    stopPct,
    cutHours,
    stopHours,
  };
}

/** Gom time_running + khung thời gian khả dụng theo bucket. */
function buildRunStopBuckets(rawData, viewMode, selection = {}) {
  const rowRunSec = (row) => Number(row.time_running) || 0;
  const rowOnSec = (row) => Number(row.time_on) || 0;

  if (viewMode === CHART_VIEW_MODES.hour) {
    const { from, year, month, day } = getSelectionRange(viewMode, selection);
    const hourMap = aggregateTelemetryByHour(
      selection.telemetryRows ?? rawData,
      from,
    );
    const hours = Array.from({ length: 24 }, (_, h) => h);
    const dayKey = toLocalDateKey(new Date(year, month - 1, day));
    return {
      labels: hours.map(formatHourLabel),
      runSec: hours.map((h) => {
        const key = `${dayKey}T${String(h).padStart(2, '0')}`;
        return Number(hourMap[key]?.time_running) || 0;
      }),
      onSec: hours.map((h) => {
        const key = `${dayKey}T${String(h).padStart(2, '0')}`;
        return Number(hourMap[key]?.time_on) || 0;
      }),
      // Mỗi cột = 1 giờ
      availSec: hours.map(() => 3600),
    };
  }

  if (viewMode === CHART_VIEW_MODES.day) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const days = getDaysInMonth(year, month - 1);
    const runMap = {};
    const onMap = {};
    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
    });
    return {
      labels: days.map(formatDayLabel),
      runSec: days.map((d) => runMap[toLocalDateKey(d)] ?? 0),
      onSec: days.map((d) => onMap[toLocalDateKey(d)] ?? 0),
      // Mỗi cột = 24h
      availSec: days.map(() => SEC_PER_DAY),
    };
  }

  if (viewMode === CHART_VIEW_MODES.week) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const weeks = getWeeksInMonth(year, month - 1);
    const runMap = {};
    const onMap = {};
    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
    });
    return {
      labels: weeks.map((w) => w.label),
      runSec: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (runMap[toLocalDateKey(d)] ?? 0), 0),
      ),
      onSec: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (onMap[toLocalDateKey(d)] ?? 0), 0),
      ),
      availSec: weeks.map((w) => w.dayCount * SEC_PER_DAY),
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const monthKeys = getMonthKeysInYear(year);
    const runMap = {};
    const onMap = {};
    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      runMap[key] = (runMap[key] || 0) + rowRunSec(row);
      onMap[key] = (onMap[key] || 0) + rowOnSec(row);
    });
    return {
      labels: monthKeys.map(formatMonthLabel),
      runSec: monthKeys.map((key) => runMap[key] ?? 0),
      onSec: monthKeys.map((key) => onMap[key] ?? 0),
      availSec: monthKeys.map((key) => {
        const [, m] = key.split('-');
        const daysInMonth = new Date(year, parseInt(m, 10), 0).getDate();
        return daysInMonth * SEC_PER_DAY;
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.quarter) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const quarters = getQuartersInYear(year);
    const runMap = {};
    const onMap = {};
    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const q = Math.floor(ts.getMonth() / 3) + 1;
      const key = `${ts.getFullYear()}-Q${q}`;
      runMap[key] = (runMap[key] || 0) + rowRunSec(row);
      onMap[key] = (onMap[key] || 0) + rowOnSec(row);
    });
    return {
      labels: quarters.map((q) => q.label),
      runSec: quarters.map((q) => runMap[q.key] ?? 0),
      onSec: quarters.map((q) => onMap[q.key] ?? 0),
      availSec: quarters.map((q) => q.dayCount * SEC_PER_DAY),
    };
  }

  if (viewMode === CHART_VIEW_MODES.range) {
    const { from, to } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);

    if (isRangeByMonth(selection)) {
      const months = getMonthsInRange(from, to);
      const spansMultipleYears = new Set(months.map((m) => m.year)).size > 1;
      const runMap = {};
      const onMap = {};
      filtered.forEach((row) => {
        const ts = new Date(row.timestamp);
        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        runMap[key] = (runMap[key] || 0) + rowRunSec(row);
        onMap[key] = (onMap[key] || 0) + rowOnSec(row);
      });
      return {
        labels: months.map((m) => formatRangeMonthLabel(m, spansMultipleYears)),
        runSec: months.map((m) => runMap[m.key] ?? 0),
        onSec: months.map((m) => onMap[m.key] ?? 0),
        availSec: months.map((m) => {
          const days = countDaysInRangeMonth(from, to, m.year, m.monthIndex);
          return Math.max(0, days) * SEC_PER_DAY;
        }),
      };
    }

    const days = getDaysInRange(from, to);
    const runMap = {};
    const onMap = {};
    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
    });
    return {
      labels: days.map((d) => formatRangeDayLabel(d, days.length)),
      runSec: days.map((d) => runMap[toLocalDateKey(d)] ?? 0),
      onSec: days.map((d) => onMap[toLocalDateKey(d)] ?? 0),
      availSec: days.map(() => SEC_PER_DAY),
    };
  }

  const { from, to } = getSelectionRange(viewMode, selection);
  const years = getYearKeysFromData(rawData, [], new Date());
  const filtered = filterInRange(rawData, from, to);
  const runMap = {};
  const onMap = {};
  filtered.forEach((row) => {
    const y = new Date(row.timestamp).getFullYear();
    runMap[y] = (runMap[y] || 0) + rowRunSec(row);
    onMap[y] = (onMap[y] || 0) + rowOnSec(row);
  });
  return {
    labels: years.map(formatYearLabel),
    runSec: years.map((y) => runMap[y] ?? 0),
    onSec: years.map((y) => onMap[y] ?? 0),
    availSec: years.map((y) => {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return (isLeap ? 366 : 365) * SEC_PER_DAY;
    }),
  };
}

/**
 * Tỷ lệ Cắt gọt / Ngưng trong cửa sổ đang chọn (cùng bộ option Giờ…Năm).
 * Cắt gọt = Σ time_running; Ngưng = Σ time_on − Σ time_running (không âm).
 */
export function buildRunStopShare(rawData, viewMode, selection = {}) {
  let runSeconds = 0;
  let onSeconds = 0;

  if (viewMode === CHART_VIEW_MODES.hour) {
    const { from } = getSelectionRange(viewMode, selection);
    const hourMap = aggregateTelemetryByHour(
      selection.telemetryRows ?? rawData,
      from,
    );
    Object.values(hourMap).forEach((bucket) => {
      runSeconds += Number(bucket?.time_running) || 0;
      onSeconds += Number(bucket?.time_on) || 0;
    });
  } else {
    const { from, to } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(
      Array.isArray(rawData) ? rawData : [],
      from,
      to,
    );
    filtered.forEach((row) => {
      runSeconds += Number(row.time_running) || 0;
      onSeconds += Number(row.time_on) || 0;
    });
  }

  if (runSeconds > onSeconds && onSeconds > 0) runSeconds = onSeconds;
  const idleSeconds = Math.max(0, onSeconds - runSeconds);

  let runPct = 0;
  let stopPct = 0;
  if (onSeconds > 0) {
    runPct = Number(((runSeconds / onSeconds) * 100).toFixed(2));
    stopPct = Number((100 - runPct).toFixed(2));
  } else if (runSeconds > 0) {
    runPct = 100;
    stopPct = 0;
  }

  return {
    runSeconds,
    onSeconds,
    idleSeconds,
    runPct,
    stopPct,
  };
}
