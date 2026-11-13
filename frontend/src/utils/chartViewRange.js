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

/** kWh từ power × Δtime_running (bỏ khoảng time_running nhảy bất thường). */
function energyKwhFromPowerSamples(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return 0;
  const sorted = [...rows].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );
  let total = 0;
  for (let i = 1; i < sorted.length; i += 1) {
    const prevRun = Number(sorted[i - 1].time_running) || 0;
    const currRun = Number(sorted[i].time_running) || 0;
    let dtSec = currRun - prevRun;
    if (dtSec <= 0) continue;
    const t0 = new Date(sorted[i - 1].timestamp).getTime();
    const t1 = new Date(sorted[i].timestamp).getTime();
    const wallSec = Number.isFinite(t0) && Number.isFinite(t1) && t1 > t0
      ? (t1 - t0) / 1000
      : 60;
    if (dtSec > Math.max(180, wallSec * 2)) continue;
    const p0 = Number(sorted[i - 1].power) || 0;
    const p1 = Number(sorted[i].power) || 0;
    total += ((p0 + p1) / 2) * (dtSec / 3600);
  }
  return total;
}

const hourSlotKey = (date) => {
  const d = date instanceof Date ? date : new Date(date);
  return `${toLocalDateKey(d)}T${String(d.getHours()).padStart(2, '0')}`;
};

const emptyHourBucket = () => ({
  time_on: 0,
  time_running: 0,
  time_setup: 0,
  power_consumption: 0,
  product: 0,
});

export function isLocalCalendarToday(year, month, day, now = new Date()) {
  return (
    Number(year) === now.getFullYear()
    && Number(month) === now.getMonth() + 1
    && Number(day) === now.getDate()
  );
}

/** 24 cột 00h–23h của một ngày lịch. */
export function getCalendarDayHourSlots(dayDate) {
  const dayStart = startOfDay(dayDate);
  return Array.from({ length: 24 }, (_, h) => {
    const start = new Date(dayStart);
    start.setHours(h, 0, 0, 0);
    const end = h === 23
      ? endOfDay(dayStart)
      : new Date(start.getTime() + 3600 * 1000);
    return { start, end, hour: h, key: hourSlotKey(start) };
  });
}

/** 24 giờ đồng hồ kết thúc ở giờ hiện tại (cột cuối = giờ đang chạy). */
export function getRollingHourSlots(now = new Date()) {
  const currentHourStart = new Date(now);
  currentHourStart.setMinutes(0, 0, 0);
  return Array.from({ length: 24 }, (_, i) => {
    const start = new Date(currentHourStart.getTime() - (23 - i) * 3600 * 1000);
    const end = i === 23 ? new Date(now) : new Date(start.getTime() + 3600 * 1000);
    return { start, end, hour: start.getHours(), key: hourSlotKey(start) };
  });
}

const formatDayMonthLabel = (date) => `${date.getDate()}/${date.getMonth() + 1}`;

function startOfCurrentMonthWeek(now) {
  const d = startOfDay(now);
  const weekIndex0 = Math.floor((d.getDate() - 1) / 7);
  return new Date(d.getFullYear(), d.getMonth(), weekIndex0 * 7 + 1);
}

function formatWeekRangeTooltip(label, from, to) {
  return `${label} (${formatDayMonthLabel(from)}–${formatDayMonthLabel(to)})`;
}

/** 30 ngày lịch kết thúc ở hôm nay (gồm hôm nay). */
export function getRollingDaySlots(now = new Date(), count = 30) {
  const end = startOfDay(now);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(end);
    date.setDate(end.getDate() - (count - 1 - i));
    const dayMonth = formatDayMonthLabel(date);
    return {
      date,
      key: toLocalDateKey(date),
      // Trục X / tooltip: ngày/tháng — vd. 20/10
      label: dayMonth,
      tooltipLabel: dayMonth,
    };
  });
}

function resolveHourSlots(selection = {}) {
  const { from, year, month, day } = getSelectionRange(CHART_VIEW_MODES.hour, selection);
  const now = selection.now instanceof Date
    ? selection.now
    : new Date(selection.now || Date.now());
  if (selection.rollingHourFromNow && isLocalCalendarToday(year, month, day, now)) {
    return getRollingHourSlots(now);
  }
  return getCalendarDayHourSlots(from);
}

function resolveDaySlots(selection = {}) {
  const { year, month } = getSelectionRange(CHART_VIEW_MODES.day, selection);
  const now = selection.now instanceof Date
    ? selection.now
    : new Date(selection.now || Date.now());
  if (
    selection.rollingDayFromNow
    && Number(year) === now.getFullYear()
    && Number(month) === now.getMonth() + 1
  ) {
    return getRollingDaySlots(now, 30);
  }
  return getDaysInMonth(year, month - 1).map((date) => {
    const dayMonth = formatDayMonthLabel(date);
    return {
      date,
      key: toLocalDateKey(date),
      // Trục X / tooltip: ngày/tháng — vd. 20/10
      label: dayMonth,
      tooltipLabel: dayMonth,
    };
  });
}

/** 5 tuần 7 ngày kết thúc ở tuần hiện tại (gồm tuần hiện tại). */
export function getRollingWeekSlots(now = new Date(), count = 5) {
  const currentStart = startOfCurrentMonthWeek(now);
  return Array.from({ length: count }, (_, i) => {
    const from = new Date(currentStart);
    from.setDate(currentStart.getDate() - (count - 1 - i) * 7);
    from.setHours(0, 0, 0, 0);
    const days = Array.from({ length: 7 }, (_, dayOffset) => {
      const date = new Date(from);
      date.setDate(from.getDate() + dayOffset);
      return date;
    });
    const to = days[days.length - 1];
    const label = `T${i + 1}`;
    return {
      key: toLocalDateKey(from),
      label,
      tooltipLabel: formatWeekRangeTooltip(label, from, to),
      weekIndex: i + 1,
      days,
      from: startOfDay(from),
      to: endOfDay(to),
      dayCount: days.length,
    };
  });
}

function resolveWeekSlots(selection = {}) {
  const { year, month } = getSelectionRange(CHART_VIEW_MODES.week, selection);
  const now = selection.now instanceof Date
    ? selection.now
    : new Date(selection.now || Date.now());
  if (
    selection.rollingWeekFromNow
    && Number(year) === now.getFullYear()
    && Number(month) === now.getMonth() + 1
  ) {
    return getRollingWeekSlots(now, 5);
  }
  return getWeeksInMonth(year, month - 1).map((week) => ({
    ...week,
    tooltipLabel: formatWeekRangeTooltip(week.label, week.from, week.to),
  }));
}

function monthSlotFromParts(year, month) {
  const lastDay = new Date(year, month, 0).getDate();
  const from = new Date(year, month - 1, 1);
  return {
    key: `${year}-${String(month).padStart(2, '0')}`,
    year,
    month,
    label: `T${month}`,
    tooltipLabel: `T${month}/${year}`,
    from,
    to: endOfDay(new Date(year, month, 0)),
    dayCount: lastDay,
  };
}

/** Tháng hiện tại và 12 tháng liền trước (13 cột). */
export function getRollingMonthSlots(now = new Date(), count = 13) {
  const end = new Date(now.getFullYear(), now.getMonth(), 1);
  return Array.from({ length: count }, (_, i) => {
    const date = new Date(end.getFullYear(), end.getMonth() - (count - 1 - i), 1);
    return monthSlotFromParts(date.getFullYear(), date.getMonth() + 1);
  });
}

function resolveMonthSlots(selection = {}) {
  const { year } = getSelectionRange(CHART_VIEW_MODES.month, selection);
  const now = selection.now instanceof Date
    ? selection.now
    : new Date(selection.now || Date.now());
  if (selection.rollingMonthFromNow && Number(year) === now.getFullYear()) {
    return getRollingMonthSlots(now, 13);
  }
  return getMonthKeysInYear(year).map((key) => {
    const month = parseInt(key.split('-')[1], 10);
    return monthSlotFromParts(year, month);
  });
}

/**
 * Gom telemetry thô theo danh sách slot giờ (delta time_on / time_running; kWh từ power).
 */
export function aggregateTelemetryByHourSlots(rawRows = [], slots = []) {
  const byHour = {};
  slots.forEach((slot) => {
    byHour[slot.key] = emptyHourBucket();
  });
  if (!slots.length) return byHour;

  const windowStart = slots[0].start.getTime();
  const windowEnd = slots[slots.length - 1].end.getTime();
  const samples = (Array.isArray(rawRows) ? rawRows : [])
    .filter((d) => d?.timestamp)
    .map((d) => ({ ...d, _ts: new Date(d.timestamp).getTime() }))
    .filter((d) => Number.isFinite(d._ts))
    .sort((a, b) => a._ts - b._ts);

  const buckets = slots.map(() => []);
  samples.forEach((s) => {
    if (s._ts < windowStart || s._ts > windowEnd) return;
    for (let i = 0; i < slots.length; i += 1) {
      const start = slots[i].start.getTime();
      const end = slots[i].end.getTime();
      const last = i === slots.length - 1;
      if (s._ts >= start && (last ? s._ts <= end : s._ts < end)) {
        buckets[i].push(s);
        break;
      }
    }
  });

  let prevClose = null;
  const before = samples.filter((s) => s._ts < windowStart);
  if (before.length > 0) prevClose = before[before.length - 1];

  for (let i = 0; i < slots.length; i += 1) {
    const bucket = buckets[i];
    if (bucket.length === 0) continue;
    const first = bucket[0];
    const last = bucket[bucket.length - 1];
    const baseOn = Number(prevClose?.time_on ?? first.time_on) || 0;
    const baseRun = Number(prevClose?.time_running ?? first.time_running) || 0;
    const baseSetup = Number(prevClose?.time_setup ?? first.time_setup) || 0;
    const baseProduct = Number(prevClose?.product ?? first.product) || 0;
    const chain = prevClose ? [prevClose, ...bucket] : bucket;
    byHour[slots[i].key] = {
      time_on: Math.max(0, (Number(last.time_on) || 0) - baseOn),
      time_running: Math.max(0, (Number(last.time_running) || 0) - baseRun),
      time_setup: Math.max(0, (Number(last.time_setup) || 0) - baseSetup),
      power_consumption: energyKwhFromPowerSamples(chain),
      product: Math.max(0, (Number(last.product) || 0) - baseProduct),
    };
    prevClose = last;
  }

  return byHour;
}

/**
 * Gom telemetry thô theo giờ trong một ngày (delta time_on / time_running; kWh từ power).
 * @returns {Record<string, { time_on: number, time_running: number, time_setup: number, power_consumption: number, product: number }>}
 */
export function aggregateTelemetryByHour(rawRows = [], dayDate) {
  return aggregateTelemetryByHourSlots(rawRows, getCalendarDayHourSlots(dayDate));
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

  if (viewMode === CHART_VIEW_MODES.week) {
    const weeks = resolveWeekSlots(selection);
    const from = weeks[0]?.from || new Date();
    const to = weeks[weeks.length - 1]?.to || new Date();
    const filtered = filterInRange(rawData, from, to);
    const outputMap = {};
    const inputMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      outputMap[key] = row.product ?? 0;
      inputMap[key] = row.input_material ?? 0;
    });

    return {
      labels: weeks.map((w) => w.label),
      tooltipLabels: weeks.map((w) => w.tooltipLabel || w.label),
      output: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (outputMap[toLocalDateKey(d)] ?? 0), 0),
      ),
      input: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (inputMap[toLocalDateKey(d)] ?? 0), 0),
      ),
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

  if (viewMode === CHART_VIEW_MODES.quarter) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const quarters = getQuartersInYear(year);
    const outputMap = {};
    const inputMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const q = Math.floor(ts.getMonth() / 3) + 1;
      const key = `${ts.getFullYear()}-Q${q}`;
      outputMap[key] = (outputMap[key] || 0) + (row.product ?? 0);
      inputMap[key] = (inputMap[key] || 0) + (row.input_material ?? 0);
    });

    return {
      labels: quarters.map((q) => q.label),
      output: quarters.map((q) => outputMap[q.key] ?? 0),
      input: quarters.map((q) => inputMap[q.key] ?? 0),
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
    const slots = resolveHourSlots(selection);
    const hourMap = aggregateTelemetryByHourSlots(
      selection.telemetryRows ?? rawData,
      slots,
    );
    return {
      labels: slots.map((slot) => formatHourLabel(slot.hour)),
      timeRun: slots.map((slot) => (Number(hourMap[slot.key]?.time_running) || 0) / 3600),
      energyKwh: slots.map((slot) => Number(hourMap[slot.key]?.power_consumption) || 0),
      performance: slots.map((slot) => {
        const runH = (Number(hourMap[slot.key]?.time_running) || 0) / 3600;
        return Math.min(100, Number((runH * 100).toFixed(1)));
      }),
      outputRate: slots.map((slot) => {
        const runH = (Number(hourMap[slot.key]?.time_running) || 0) / 3600;
        return calcOutputRateTonsPerHour(hourMap[slot.key]?.product ?? 0, runH);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.day) {
    const slots = resolveDaySlots(selection);
    const from = startOfDay(slots[0]?.date || new Date());
    const to = endOfDay(slots[slots.length - 1]?.date || new Date());
    const filtered = filterInRange(rawData, from, to);
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
      labels: slots.map((slot) => slot.label),
      tooltipLabels: slots.map((slot) => slot.tooltipLabel || slot.label),
      timeRun: slots.map((slot) => timeMap[slot.key] ?? 0),
      energyKwh: slots.map((slot) => energyMap[slot.key] ?? 0),
      performance: slots.map((slot) => calcPerformancePct(timeMap[slot.key] ?? 0, 1)),
      outputRate: slots.map((slot) => (
        calcOutputRateTonsPerHour(outputMap[slot.key] ?? 0, timeMap[slot.key] ?? 0)
      )),
    };
  }

  if (viewMode === CHART_VIEW_MODES.week) {
    const weeks = resolveWeekSlots(selection);
    const from = weeks[0]?.from || new Date();
    const to = weeks[weeks.length - 1]?.to || new Date();
    const filtered = filterInRange(rawData, from, to);
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
      tooltipLabels: weeks.map((w) => w.tooltipLabel || w.label),
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
    const slots = resolveMonthSlots(selection);
    const from = slots[0]?.from || new Date();
    const to = slots[slots.length - 1]?.to || new Date();
    const filtered = filterInRange(rawData, from, to);
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
      labels: slots.map((slot) => slot.label),
      tooltipLabels: slots.map((slot) => slot.tooltipLabel || slot.label),
      timeRun: slots.map((slot) => timeMap[slot.key] ?? 0),
      energyKwh: slots.map((slot) => energyMap[slot.key] ?? 0),
      performance: slots.map((slot) =>
        calcPerformancePct(timeMap[slot.key] ?? 0, slot.dayCount),
      ),
      outputRate: slots.map((slot) =>
        calcOutputRateTonsPerHour(outputMap[slot.key] ?? 0, timeMap[slot.key] ?? 0),
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

  if (viewMode === CHART_VIEW_MODES.week) {
    const weeks = resolveWeekSlots(selection);
    const from = weeks[0]?.from || new Date();
    const to = weeks[weeks.length - 1]?.to || new Date();
    const filtered = filterInRange(allErrors || [], from, to);
    const countMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      countMap[key] = (countMap[key] || 0) + 1;
    });

    return {
      labels: weeks.map((w) => w.label),
      tooltipLabels: weeks.map((w) => w.tooltipLabel || w.label),
      values: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (countMap[toLocalDateKey(d)] ?? 0), 0),
      ),
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

  if (viewMode === CHART_VIEW_MODES.quarter) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(allErrors || [], from, to);
    const quarters = getQuartersInYear(year);
    const countMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const q = Math.floor(ts.getMonth() / 3) + 1;
      const key = `${ts.getFullYear()}-Q${q}`;
      countMap[key] = (countMap[key] || 0) + 1;
    });

    return {
      labels: quarters.map((q) => q.label),
      values: quarters.map((q) => countMap[q.key] ?? 0),
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

/** Lọc rows theo cùng khoảng ngày/tháng/năm đang chọn trên biểu đồ. */
export function filterRowsByChartSelection(rows, viewMode, selection = {}, timestampKey = 'timestamp') {
  const { from, to } = getSelectionRange(viewMode, selection);
  return filterInRange(rows || [], from, to, timestampKey);
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
 * Chuỗi % / giờ Cắt gọt–Setup–Ngưng theo bucket (cùng trục X Giờ…Năm).
 * %: cắt gọt = time_running / khung × 100; setup = time_setup / khung × 100;
 *     ngưng = 100 − cắt gọt − setup.
 * Giờ: cắt gọt = time_running; setup = time_setup; ngưng = khung − cắt − setup.
 */
export function buildRunStopPctSeries(rawData, viewMode, selection = {}) {
  const buckets = buildRunStopBuckets(rawData, viewMode, selection);
  const n = buckets.labels.length;
  const setupSecArr = buckets.setupSec || buckets.runSec.map(() => 0);
  const cutPct = [];
  const setupPct = [];
  const stopPct = [];
  const cutHours = [];
  const setupHours = [];
  const stopHours = [];

  for (let i = 0; i < n; i += 1) {
    const avail = Number(buckets.availSec[i]) || 0;
    const on = Number(buckets.onSec[i]) || 0;
    let runSec = Number(buckets.runSec[i]) || 0;
    let setupSec = Number(setupSecArr[i]) || 0;
    const empty = runSec <= 0 && setupSec <= 0 && on <= 0;
    if (empty) {
      cutPct.push(0);
      setupPct.push(0);
      stopPct.push(0);
      cutHours.push(0);
      setupHours.push(0);
      stopHours.push(0);
      continue;
    }
    if (avail > 0 && runSec + setupSec > avail) {
      if (runSec > avail) {
        runSec = avail;
        setupSec = 0;
      } else {
        setupSec = Math.max(0, avail - runSec);
      }
    }
    const cut = avail <= 0 ? 0 : Math.min(100, Math.max(0, (runSec / avail) * 100));
    const setup = avail <= 0 ? 0 : Math.min(Math.max(0, 100 - cut), Math.max(0, (setupSec / avail) * 100));
    const stop = Math.max(0, 100 - cut - setup);
    cutPct.push(Number(cut.toFixed(1)));
    setupPct.push(Number(setup.toFixed(1)));
    stopPct.push(Number(stop.toFixed(1)));
    cutHours.push(Number((runSec / 3600).toFixed(2)));
    setupHours.push(Number((setupSec / 3600).toFixed(2)));
    stopHours.push(Number((Math.max(0, avail - runSec - setupSec) / 3600).toFixed(2)));
  }

  return {
    labels: buckets.labels,
    tooltipLabels: buckets.tooltipLabels || buckets.labels,
    cutPct,
    setupPct,
    stopPct,
    cutHours,
    setupHours,
    stopHours,
  };
}

/** Gom time_running + khung thời gian khả dụng theo bucket. */
function buildRunStopBuckets(rawData, viewMode, selection = {}) {
  const rowRunSec = (row) => Number(row.time_running) || 0;
  const rowOnSec = (row) => Number(row.time_on) || 0;
  const rowSetupSec = (row) => Number(row.time_setup) || 0;

  if (viewMode === CHART_VIEW_MODES.hour) {
    const slots = resolveHourSlots(selection);
    const hourMap = aggregateTelemetryByHourSlots(
      selection.telemetryRows ?? rawData,
      slots,
    );
    return {
      labels: slots.map((slot) => formatHourLabel(slot.hour)),
      runSec: slots.map((slot) => Number(hourMap[slot.key]?.time_running) || 0),
      onSec: slots.map((slot) => Number(hourMap[slot.key]?.time_on) || 0),
      setupSec: slots.map((slot) => Number(hourMap[slot.key]?.time_setup) || 0),
      availSec: slots.map((slot) => (
        Math.max(1, Math.round((slot.end.getTime() - slot.start.getTime()) / 1000))
      )),
    };
  }

  if (viewMode === CHART_VIEW_MODES.day) {
    const slots = resolveDaySlots(selection);
    const from = startOfDay(slots[0]?.date || new Date());
    const to = endOfDay(slots[slots.length - 1]?.date || new Date());
    const filtered = filterInRange(rawData, from, to);
    const runMap = {};
    const onMap = {};
    const setupMap = {};
    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
      setupMap[key] = rowSetupSec(row);
    });
    const now = selection.now instanceof Date
      ? selection.now
      : new Date(selection.now || Date.now());
    return {
      labels: slots.map((slot) => slot.label),
      tooltipLabels: slots.map((slot) => slot.tooltipLabel || slot.label),
      runSec: slots.map((slot) => runMap[slot.key] ?? 0),
      onSec: slots.map((slot) => onMap[slot.key] ?? 0),
      setupSec: slots.map((slot) => setupMap[slot.key] ?? 0),
      availSec: slots.map((slot, index) => {
        if (index === slots.length - 1 && selection.rollingDayFromNow) {
          const elapsed = Math.round((now.getTime() - slot.date.getTime()) / 1000);
          return Math.max(1, Math.min(SEC_PER_DAY, elapsed));
        }
        return SEC_PER_DAY;
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.week) {
    const weeks = resolveWeekSlots(selection);
    const from = weeks[0]?.from || new Date();
    const to = weeks[weeks.length - 1]?.to || new Date();
    const filtered = filterInRange(rawData, from, to);
    const runMap = {};
    const onMap = {};
    const setupMap = {};
    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
      setupMap[key] = rowSetupSec(row);
    });
    const now = selection.now instanceof Date
      ? selection.now
      : new Date(selection.now || Date.now());
    const todayStart = startOfDay(now);
    return {
      labels: weeks.map((w) => w.label),
      tooltipLabels: weeks.map((w) => w.tooltipLabel || w.label),
      runSec: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (runMap[toLocalDateKey(d)] ?? 0), 0),
      ),
      onSec: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (onMap[toLocalDateKey(d)] ?? 0), 0),
      ),
      setupSec: weeks.map((w) =>
        w.days.reduce((sum, d) => sum + (setupMap[toLocalDateKey(d)] ?? 0), 0),
      ),
      availSec: weeks.map((w, index) => {
        if (index !== weeks.length - 1 || !selection.rollingWeekFromNow) {
          return w.dayCount * SEC_PER_DAY;
        }
        let sec = 0;
        w.days.forEach((date) => {
          const dayStart = startOfDay(date);
          if (dayStart > todayStart) return;
          if (dayStart.getTime() === todayStart.getTime()) {
            sec += Math.max(1, Math.round((now.getTime() - dayStart.getTime()) / 1000));
          } else {
            sec += SEC_PER_DAY;
          }
        });
        return Math.max(1, sec);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
    const slots = resolveMonthSlots(selection);
    const from = slots[0]?.from || new Date();
    const to = slots[slots.length - 1]?.to || new Date();
    const filtered = filterInRange(rawData, from, to);
    const runMap = {};
    const onMap = {};
    const setupMap = {};
    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      runMap[key] = (runMap[key] || 0) + rowRunSec(row);
      onMap[key] = (onMap[key] || 0) + rowOnSec(row);
      setupMap[key] = (setupMap[key] || 0) + rowSetupSec(row);
    });
    const now = selection.now instanceof Date
      ? selection.now
      : new Date(selection.now || Date.now());
    return {
      labels: slots.map((slot) => slot.label),
      tooltipLabels: slots.map((slot) => slot.tooltipLabel || slot.label),
      runSec: slots.map((slot) => runMap[slot.key] ?? 0),
      onSec: slots.map((slot) => onMap[slot.key] ?? 0),
      setupSec: slots.map((slot) => setupMap[slot.key] ?? 0),
      availSec: slots.map((slot, index) => {
        if (index === slots.length - 1 && selection.rollingMonthFromNow) {
          const elapsedDays = Math.max(0, now.getDate() - 1);
          const todayElapsed = Math.round((now.getTime() - startOfDay(now).getTime()) / 1000);
          return Math.max(1, elapsedDays * SEC_PER_DAY + Math.max(1, todayElapsed));
        }
        return slot.dayCount * SEC_PER_DAY;
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.quarter) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const quarters = getQuartersInYear(year);
    const runMap = {};
    const onMap = {};
    const setupMap = {};
    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const q = Math.floor(ts.getMonth() / 3) + 1;
      const key = `${ts.getFullYear()}-Q${q}`;
      runMap[key] = (runMap[key] || 0) + rowRunSec(row);
      onMap[key] = (onMap[key] || 0) + rowOnSec(row);
      setupMap[key] = (setupMap[key] || 0) + rowSetupSec(row);
    });
    return {
      labels: quarters.map((q) => q.label),
      runSec: quarters.map((q) => runMap[q.key] ?? 0),
      onSec: quarters.map((q) => onMap[q.key] ?? 0),
      setupSec: quarters.map((q) => setupMap[q.key] ?? 0),
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
      const setupMap = {};
      filtered.forEach((row) => {
        const ts = new Date(row.timestamp);
        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        runMap[key] = (runMap[key] || 0) + rowRunSec(row);
        onMap[key] = (onMap[key] || 0) + rowOnSec(row);
        setupMap[key] = (setupMap[key] || 0) + rowSetupSec(row);
      });
      return {
        labels: months.map((m) => formatRangeMonthLabel(m, spansMultipleYears)),
        runSec: months.map((m) => runMap[m.key] ?? 0),
        onSec: months.map((m) => onMap[m.key] ?? 0),
        setupSec: months.map((m) => setupMap[m.key] ?? 0),
        availSec: months.map((m) => {
          const days = countDaysInRangeMonth(from, to, m.year, m.monthIndex);
          return Math.max(0, days) * SEC_PER_DAY;
        }),
      };
    }

    const days = getDaysInRange(from, to);
    const runMap = {};
    const onMap = {};
    const setupMap = {};
    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      runMap[key] = rowRunSec(row);
      onMap[key] = rowOnSec(row);
      setupMap[key] = rowSetupSec(row);
    });
    return {
      labels: days.map((d) => formatRangeDayLabel(d, days.length)),
      runSec: days.map((d) => runMap[toLocalDateKey(d)] ?? 0),
      onSec: days.map((d) => onMap[toLocalDateKey(d)] ?? 0),
      setupSec: days.map((d) => setupMap[toLocalDateKey(d)] ?? 0),
      availSec: days.map(() => SEC_PER_DAY),
    };
  }

  const { from, to } = getSelectionRange(viewMode, selection);
  const years = getYearKeysFromData(rawData, [], new Date());
  const filtered = filterInRange(rawData, from, to);
  const runMap = {};
  const onMap = {};
  const setupMap = {};
  filtered.forEach((row) => {
    const y = new Date(row.timestamp).getFullYear();
    runMap[y] = (runMap[y] || 0) + rowRunSec(row);
    onMap[y] = (onMap[y] || 0) + rowOnSec(row);
    setupMap[y] = (setupMap[y] || 0) + rowSetupSec(row);
  });
  return {
    labels: years.map(formatYearLabel),
    runSec: years.map((y) => runMap[y] ?? 0),
    onSec: years.map((y) => onMap[y] ?? 0),
    setupSec: years.map((y) => setupMap[y] ?? 0),
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
