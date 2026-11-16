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
