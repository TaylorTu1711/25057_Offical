import httpProxy from 'http-proxy';
import { getDtrSortMachineById } from '../utils/dtrSortMachines.js';

const proxy = httpProxy.createProxyServer({
  xfwd: true,
  changeOrigin: true,
  ws: true,
  proxyTimeout: 60_000,
  timeout: 60_000,
});

proxy.on('error', (err, req, res) => {
  console.error('[dtr-proxy]', err.message);
  if (res && !res.headersSent && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('DTR proxy error: không kết nối được máy qua Tailscale.');
    return;
  }
  if (res && typeof res.end === 'function') {
    try {
      res.end();
    } catch {
      /* ignore */
    }
  }
});

/** /dtr/sortmachine và /dtr/sortmachine/ → SPA danh sách (không proxy). */
function isListPath(pathname) {
  return pathname === '/dtr/sortmachine' || pathname === '/dtr/sortmachine/';
}

/**
 * /dtr/sortmachine/:id[/...] → http://{tailscale_ip}:{port}/...
 * Strip prefix /dtr/sortmachine/:id để app nội bộ chạy như root /.
 */
export function parseDtrProxyPath(pathname) {
  if (isListPath(pathname)) return null;
  const match = pathname.match(/^\/dtr\/sortmachine\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const machineId = decodeURIComponent(match[1]);
  const rest = match[2] && match[2].length > 0 ? match[2] : '/';
  return { machineId, rest };
}

async function resolveTarget(machineId) {
  const machine = await getDtrSortMachineById(machineId);
  if (!machine) return { errorStatus: 404, error: 'Không tìm thấy máy' };
  const port = Number(machine.port) > 0 ? Number(machine.port) : 5173;
  return {
    machine,
    target: `http://${machine.tailscale_ip}:${port}`,
  };
}

export function dtrSortMachineProxy(req, res, next) {
  const parsed = parseDtrProxyPath(req.path);
  if (!parsed) return next();

  resolveTarget(parsed.machineId)
    .then((resolved) => {
      if (resolved.errorStatus) {
        res.status(resolved.errorStatus).type('text').send(resolved.error);
        return;
      }

      const queryIdx = req.url.indexOf('?');
      const query = queryIdx >= 0 ? req.url.slice(queryIdx) : '';
      req.url = `${parsed.rest}${query}`;

      proxy.web(req, res, {
        target: resolved.target,
        ignorePath: false,
      });
    })
    .catch((err) => {
      console.error('[dtr-proxy] lookup', err.message);
      res.status(500).type('text').send('DTR proxy lookup error');
    });
}

/** Gắn WebSocket upgrade cho cùng path prefix. */
export function attachDtrSortMachineWsProxy(server) {
  server.on('upgrade', async (req, socket, head) => {
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url || '/', `http://${host}`);
      const parsed = parseDtrProxyPath(url.pathname);
      if (!parsed) return;

      const resolved = await resolveTarget(parsed.machineId);
      if (resolved.errorStatus) {
        socket.destroy();
        return;
      }

      req.url = `${parsed.rest}${url.search}`;
      proxy.ws(req, socket, head, { target: resolved.target });
    } catch (err) {
      console.error('[dtr-proxy] ws', err.message);
      socket.destroy();
    }
  });
}
