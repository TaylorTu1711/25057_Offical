export const CHART_VIEW_MODES = {
  day: 'day',
  month: 'month',
  year: 'year',
  range: 'range',
};

export const CHART_VIEW_MODE_LABELS = {
  [CHART_VIEW_MODES.day]: 'Chọn tháng — xem theo ngày',
  [CHART_VIEW_MODES.month]: 'Chọn năm — xem theo tháng',
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

/** @param {{ year: number, month: number }} selection month: 1–12 */
export const getChartViewPeriodLabel = (viewMode, selection = {}) => {
  const { year = new Date().getFullYear(), month = new Date().getMonth() + 1 } = selection;
  switch (viewMode) {
    case CHART_VIEW_MODES.day:
      return `Tháng ${month}/${year}`;
    case CHART_VIEW_MODES.month:
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

  if (viewMode === CHART_VIEW_MODES.day) {
    const monthIndex = month - 1;
    return {
      from: new Date(year, monthIndex, 1),
      to: endOfDay(new Date(year, monthIndex + 1, 0)),
      year,
      month,
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
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
  if (viewMode === CHART_VIEW_MODES.day) {
    const { from, to, year, month } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const days = getDaysInMonth(year, month - 1);
    const timeMap = {};
    const outputMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      timeMap[key] = (row.time_on ?? 0) / 3600;
      outputMap[key] = row.product ?? 0;
    });

    return {
      labels: days.map(formatDayLabel),
      timeRun: days.map((d) => timeMap[toLocalDateKey(d)] ?? 0),
      performance: days.map((d) => calcPerformancePct(timeMap[toLocalDateKey(d)] ?? 0, 1)),
      outputRate: days.map((d) => {
        const key = toLocalDateKey(d);
        return calcOutputRateTonsPerHour(outputMap[key] ?? 0, timeMap[key] ?? 0);
      }),
    };
  }

  if (viewMode === CHART_VIEW_MODES.month) {
    const { from, to, year } = getSelectionRange(viewMode, selection);
    const filtered = filterInRange(rawData, from, to);
    const monthKeys = getMonthKeysInYear(year);
    const timeMap = {};
    const outputMap = {};

    filtered.forEach((row) => {
      const ts = new Date(row.timestamp);
      const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
      timeMap[key] = (timeMap[key] || 0) + (row.time_on ?? 0) / 3600;
      outputMap[key] = (outputMap[key] || 0) + (row.product ?? 0);
    });

    return {
      labels: monthKeys.map(formatMonthLabel),
      timeRun: monthKeys.map((key) => timeMap[key] ?? 0),
      performance: monthKeys.map((key) => {
        const [, month] = key.split('-');
        const daysInMonth = new Date(year, parseInt(month, 10), 0).getDate();
        return calcPerformancePct(timeMap[key] ?? 0, daysInMonth);
      }),
      outputRate: monthKeys.map((key) =>
        calcOutputRateTonsPerHour(outputMap[key] ?? 0, timeMap[key] ?? 0),
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
      const outputMap = {};

      filtered.forEach((row) => {
        const ts = new Date(row.timestamp);
        const key = `${ts.getFullYear()}-${String(ts.getMonth() + 1).padStart(2, '0')}`;
        timeMap[key] = (timeMap[key] || 0) + (row.time_on ?? 0) / 3600;
        outputMap[key] = (outputMap[key] || 0) + (row.product ?? 0);
      });

      return {
        labels: months.map((m) => formatRangeMonthLabel(m, spansMultipleYears)),
        timeRun: months.map((m) => timeMap[m.key] ?? 0),
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
    const outputMap = {};

    filtered.forEach((row) => {
      const key = toLocalDateKey(row.timestamp);
      timeMap[key] = (row.time_on ?? 0) / 3600;
      outputMap[key] = row.product ?? 0;
    });

    return {
      labels: days.map((d) => formatRangeDayLabel(d, days.length)),
      timeRun: days.map((d) => timeMap[toLocalDateKey(d)] ?? 0),
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
  const outputMap = {};

  filtered.forEach((row) => {
    const y = new Date(row.timestamp).getFullYear();
    timeMap[y] = (timeMap[y] || 0) + (row.time_on ?? 0) / 3600;
    outputMap[y] = (outputMap[y] || 0) + (row.product ?? 0);
  });

  return {
    labels: years.map(formatYearLabel),
    timeRun: years.map((y) => timeMap[y] ?? 0),
    performance: years.map((y) => {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
      return calcPerformancePct(timeMap[y] ?? 0, isLeap ? 366 : 365);
    }),
    outputRate: years.map((y) =>
      calcOutputRateTonsPerHour(outputMap[y] ?? 0, timeMap[y] ?? 0),
    ),
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

/** Nhãn loại cột cho tooltip biểu đồ theo chế độ xem. */
export function getChartCategoryPrefix(viewMode, selection = {}) {
  switch (viewMode) {
    case CHART_VIEW_MODES.day:
      return 'Ngày';
    case CHART_VIEW_MODES.month:
      return 'Tháng';
    case CHART_VIEW_MODES.year:
      return 'Năm';
    case CHART_VIEW_MODES.range:
      return isRangeByMonth(selection) ? 'Tháng' : 'Ngày';
    default:
      return '';
  }
}

export const toErrorChartTickMode = (viewMode, selection = {}) => {
  if (viewMode === CHART_VIEW_MODES.day) return 'month';
  if (viewMode === CHART_VIEW_MODES.range) {
    if (isRangeByMonth(selection)) return 'year';
    const { from, to } = getSelectionRange(viewMode, selection);
    return getDaysInRange(from, to).length > 20 ? 'month' : 'year';
  }
  return 'year';
};
