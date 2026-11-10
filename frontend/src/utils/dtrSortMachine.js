/** Deep-link tới route app máy (vd. /online, /dashboard). */
export function buildDtrPublicDeepPath(machineId, appPath = '/dashboard') {
  const id = encodeURIComponent(String(machineId || '').trim());
  const rest = appPath.startsWith('/') ? appPath : `/${appPath}`;
  return id ? `/dtr/sortmachine/${id}${rest}` : '/dtr/sortmachine';
}

/** Entry mặc định: luôn /dashboard (cùng URL gõ tay đang chạy đúng). */
export function buildDtrPublicPath(machineId) {
  return buildDtrPublicDeepPath(machineId, '/dashboard');
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
