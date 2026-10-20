export const parseRuntimeSeconds = (totalSeconds) => {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
};

/** Số ngày thập phân — vd. 345.67 */
export const formatRuntimeDays = (totalSeconds, fractionDigits = 2) => {
  const total = Math.max(0, Number(totalSeconds) || 0);
  const days = total / 86400;
  return days.toLocaleString('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  });
};

/** Chuỗi đầy đủ — dùng cho aria-label, tooltip */
export const formatCumulativeRuntime = (totalSeconds) => {
  const { hours, minutes, seconds } = parseRuntimeSeconds(totalSeconds);
  const days = formatRuntimeDays(totalSeconds);
  return `${hours} giờ ${minutes} phút ${seconds} giây (${days} ngày)`;
};
