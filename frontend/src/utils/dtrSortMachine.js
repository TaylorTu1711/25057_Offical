/** Entry path: shell + iframe; address bar = /dtr/sortmachine/:id/... */
export function buildDtrPublicPath(machineId) {
  const id = encodeURIComponent(String(machineId || '').trim());
  return id ? `/dtr/sortmachine/${id}/` : '/dtr/sortmachine';
}

/** Deep-link tới route app máy (vd. /online, /dashboard). */
export function buildDtrPublicDeepPath(machineId, appPath = '/') {
  const id = encodeURIComponent(String(machineId || '').trim());
  const rest = appPath.startsWith('/') ? appPath : `/${appPath}`;
  return id ? `/dtr/sortmachine/${id}${rest}` : '/dtr/sortmachine';
}

/** URL nội bộ qua Tailscale — chỉ dùng debug / máy đã có Tailscale. */
export function buildDtrTailscaleUrl(machine) {
  if (!machine?.tailscale_ip) return '';
  const port = Number(machine.port) > 0 ? Number(machine.port) : 5173;
  return `http://${machine.tailscale_ip}:${port}/`;
}

/** Mở máy qua domain path — client KHÔNG cần cài Tailscale. */
export function openDtrTailscaleMachine(machine) {
  if (!machine?.machine_id) return false;
  window.location.assign(buildDtrPublicPath(machine.machine_id));
  return true;
}
