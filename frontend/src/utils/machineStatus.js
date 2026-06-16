export const normalizeMachineStatus = (status) => {
  const value = Number(status);
  return Number.isFinite(value) ? value : null;
};

export const getMachineStatusLabel = (status) => {
  switch (normalizeMachineStatus(status)) {
    case 0:
    case 1:
      return 'Đang dừng';
    case 2:
      return 'Đang chạy';
    default:
      return 'NA';
  }
};

export const getMachineStatusClass = (status) => {
  switch (normalizeMachineStatus(status)) {
    case 0:
    case 1:
      return 'bg-warning text-dark';
    case 2:
      return 'bg-success';
    default:
      return 'bg-secondary';
  }
};

export const getMachineStatusLabelWithEmoji = (status) => {
  switch (normalizeMachineStatus(status)) {
    case 0:
    case 1:
      return '🟡 Đang dừng';
    case 2:
      return '🟢 Đang chạy';
    default:
      return 'NA';
  }
};

export const isMachineRunning = (status) => normalizeMachineStatus(status) === 2;

/** Biểu đồ trạng thái 24h: chỉ Stop (1) và Auto (2); Maint (0) gộp vào Stop. */
export const toStatusChartValue = (status) => {
  const s = normalizeMachineStatus(status);
  if (s == null) return null;
  return s === 2 ? 2 : 1;
};

export const getStatusChartLabel = (chartValue) => {
  const v = Number(chartValue);
  if (v === 2) return 'Auto';
  if (v === 1) return 'Stop';
  return '—';
};

export const isMachineConnected = (lastUpdated, nowMs = Date.now(), thresholdMinutes = 2) => {
  if (!lastUpdated) return false;
  const last = new Date(lastUpdated).getTime();
  if (!Number.isFinite(last)) return false;
  return (nowMs - last) / 1000 / 60 < thresholdMinutes;
};

/** Trạng thái hiển thị có tính kết nối PLC (giống trang Machine). */
export const resolveMachineDisplayStatus = (
  status,
  lastUpdated,
  nowMs = Date.now(),
  thresholdMinutes = 2,
) => {
  const connected = isMachineConnected(lastUpdated, nowMs, thresholdMinutes);
  if (!connected) {
    return {
      connected: false,
      running: false,
      label: 'Đang dừng',
      labelWithEmoji: '🟡 Đang dừng',
      className: getMachineStatusClass(1),
    };
  }

  return {
    connected: true,
    running: isMachineRunning(status),
    label: getMachineStatusLabel(status),
    labelWithEmoji: getMachineStatusLabelWithEmoji(status),
    className: getMachineStatusClass(status),
  };
};

export const getMachineStatusLabelForDisplay = (status, lastUpdated, nowMs, thresholdMinutes = 2) =>
  resolveMachineDisplayStatus(status, lastUpdated, nowMs, thresholdMinutes).label;

export const getMachineStatusLabelWithEmojiForDisplay = (
  status,
  lastUpdated,
  nowMs,
  thresholdMinutes = 2,
) => resolveMachineDisplayStatus(status, lastUpdated, nowMs, thresholdMinutes).labelWithEmoji;
