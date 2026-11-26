/**
 * Dòng chữ nhỏ theo tab giờ/ngày/tháng/quý/năm đang chọn
 * (pie không nhãn, biểu đồ thống kê số chai, …).
 */
export function formatDtrPeriodCaption(mode, { year, month, day } = {}) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  const hasY = Number.isFinite(y) && y > 0;
  const hasM = Number.isFinite(m) && m >= 1 && m <= 12;
  const hasD = Number.isFinite(d) && d >= 1 && d <= 31;
  const pad2 = (n) => String(Number(n) || 0).padStart(2, '0');
  switch (String(mode || '').toLowerCase()) {
    case 'hour':
      if (hasD && hasM && hasY) return `Ngày ${pad2(d)}/${pad2(m)}/${y}`;
      return '';
    case 'day':
    case 'week':
      if (hasM && hasY) return `Tháng ${pad2(m)}/${y}`;
      return '';
    case 'month':
      return hasY ? `Năm ${y}` : '';
    case 'quarter':
      return hasY ? `Theo quý · ${y}` : '';
    case 'year':
      return 'Theo năm';
    default:
      return '';
  }
}

/**
 * Số tổng giữa pie / cột tổng: > 1 triệu → "1,x" + đơn vị "triệu chai".
 * @returns {{ text: string, unit: string, full: string }}
 */
export function formatDtrBottleCenterTotal(raw) {
  const n = Number(raw) || 0;
  const full = `${n.toLocaleString('vi-VN')} chai`;
  if (n > 1_000_000) {
    const text = (n / 1_000_000).toLocaleString('vi-VN', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 1,
    });
    return { text, unit: 'triệu chai', full };
  }
  return { text: n.toLocaleString('vi-VN'), unit: 'chai', full };
}

/** Deep-link tới route app máy (vd. /s, /online, /dashboard). */
export function buildDtrPublicDeepPath(machineId, appPath = '/s') {
  const id = encodeURIComponent(String(machineId || '').trim());
  const rest = appPath.startsWith('/') ? appPath : `/${appPath}`;
  return id ? `/dtr/sortmachine/${id}${rest}` : '/dtr/sortmachine';
}

/** Entry mặc định: /s trên máy sort. */
export function buildDtrPublicPath(machineId) {
  return buildDtrPublicDeepPath(machineId, '/s');
}

/** URL nội bộ qua Tailscale — chỉ dùng debug / máy đã có Tailscale. */
export function buildDtrTailscaleUrl(machine) {
  if (!machine?.tailscale_ip) return '';
  const port = Number(machine.port) > 0 ? Number(machine.port) : 5173;
  return `http://${machine.tailscale_ip}:${port}/`;
}

/** Mở máy qua domain — hard navigation (không để React Router nuốt path). */
export function openDtrTailscaleMachine(machine) {
  if (!machine?.machine_id) return false;
  const url = buildDtrPublicPath(machine.machine_id);
  window.location.assign(url);
  return true;
}
