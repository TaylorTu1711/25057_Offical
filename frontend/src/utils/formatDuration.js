export const parseRuntimeSeconds = (totalSeconds) => {
  const total = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  return {
    hours: Math.floor(total / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
};

/** Chuỗi đầy đủ — dùng cho aria-label, tooltip */
export const formatCumulativeRuntime = (totalSeconds) => {
  const { hours, minutes, seconds } = parseRuntimeSeconds(totalSeconds);
  return `${hours} giờ ${minutes} phút ${seconds} giây`;
};
