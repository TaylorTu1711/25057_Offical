/** Khóa ngày theo giờ local (YYYY-MM-DD) */
export const toLocalDateKey = (input) => {
  const d = input instanceof Date ? input : new Date(input);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Nhãn hiển thị: mã + tên lỗi (nếu có) */
export const formatErrorLabel = (code, name) => {
  const c = (code != null ? String(code) : '').trim();
  const n = (name != null ? String(name) : '').trim();
  if (!c && !n) return 'N/A';
  if (!n || n === c) return c || n;
  return `${c}. ${n}`;
};

export const getAlarmCode = (item) => {
  if (item.alarm_id != null && String(item.alarm_id).trim() !== '') {
    return String(item.alarm_id);
  }
  if (item.alarm_code != null && String(item.alarm_code).trim() !== '') {
    return String(item.alarm_code);
  }
  return null;
};

export const buildErrorStats = (data) => {
  const errorCountMap = {};
  (data || []).forEach((item) => {
    const code = getAlarmCode(item) ?? item.alarm_name ?? 'N/A';
    if (!errorCountMap[code]) {
      errorCountMap[code] = { code, message: item.alarm_name, count: 0 };
    }
    errorCountMap[code].count += 1;
  });

  const sortedStats = Object.values(errorCountMap).sort((a, b) => b.count - a.count);

  return {
    labels: sortedStats.map((item) => item.code),
    tooltipLabels: sortedStats.map((item) => item.message || item.code),
    displayLabels: sortedStats.map((item) => formatErrorLabel(item.code, item.message)),
    dataValues: sortedStats.map((item) => item.count),
  };
};

/** Lấy top N lỗi có tần suất cao nhất từ kết quả buildErrorStats. */
export function takeTopErrorStats(stats, limit) {
  if (!stats || !limit || limit <= 0) return stats;
  return {
    labels: stats.labels.slice(0, limit),
    tooltipLabels: stats.tooltipLabels.slice(0, limit),
    displayLabels: stats.displayLabels.slice(0, limit),
    dataValues: stats.dataValues.slice(0, limit),
  };
}

export const filterErrorsOnDay = (errors, dayKey) =>
  (errors || []).filter((item) => item?.timestamp && toLocalDateKey(item.timestamp) === dayKey);

export const filterErrorsInMonth = (errors, yearMonth) => {
  if (!yearMonth) return [];
  const [y, m] = yearMonth.split('-').map((n) => parseInt(n, 10));
  if (!y || !m) return [];

  return (errors || []).filter((item) => {
    if (!item?.timestamp) return false;
    const ts = new Date(item.timestamp);
    return ts.getFullYear() === y && ts.getMonth() + 1 === m;
  });
};

/** Đếm lỗi theo từng ngày trong tháng (đủ ngày, ngày không lỗi = 0) */
export const buildErrorsByDayInMonth = (errors, yearMonth) => {
  const [y, m] = yearMonth.split('-').map((n) => parseInt(n, 10));
  const daysInMonth = new Date(y, m, 0).getDate();
  const countByDay = {};

  filterErrorsInMonth(errors, yearMonth).forEach((item) => {
    const key = toLocalDateKey(item.timestamp);
    countByDay[key] = (countByDay[key] || 0) + 1;
  });

  const labels = [];
  const dataValues = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(y, m - 1, day);
    const key = toLocalDateKey(date);
    labels.push(`${String(day).padStart(2, '0')}-${String(m).padStart(2, '0')}`);
    dataValues.push(countByDay[key] || 0);
  }

  return { labels, dataValues };
};

export const getDefaultDayKey = (errors) => {
  if (!errors?.length) return toLocalDateKey(new Date());
  const latest = errors.reduce((a, b) =>
    new Date(a.timestamp) > new Date(b.timestamp) ? a : b,
  );
  return toLocalDateKey(latest.timestamp);
};

export const getDefaultYearMonth = (errors) => {
  const dayKey = getDefaultDayKey(errors);
  return dayKey.slice(0, 7);
};
