import httpProxy from 'http-proxy';
import zlib from 'zlib';
import { getDtrSortMachineById } from '../utils/dtrSortMachines.js';

const proxy = httpProxy.createProxyServer({
  xfwd: true,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,
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

function publicPrefix(machineId) {
  return `/dtr/sortmachine/${encodeURIComponent(machineId)}`;
}

/**
 * Vite/React thường dùng path tuyệt đối /assets, /manifest, /@vite...
 * Khi proxy dưới subpath, rewrite về /dtr/sortmachine/<id>/...
 */
export function rewriteAbsolutePaths(content, machineId) {
  const prefix = publicPrefix(machineId);
  let out = content;

  // href="/x" src="/x" action="/x" content="/x" (không đụng //cdn)
  out = out.replace(
    /((?:href|src|action|content)=["'])\/(?!\/)/gi,
    `$1${prefix}/`,
  );

  // url(/x) trong CSS inline
  out = out.replace(/url\(\s*['"]?\/(?!\/)/gi, (m) => m.replace('/', `${prefix}/`));

  // import "/x" hoặc from "/x"
  out = out.replace(/((?:from|import)\s+["'])\/(?!\/)/g, `$1${prefix}/`);

  // Vite classic: "/@vite/client", "/src/..."
  out = out.replace(/(["'`])\/(@vite|@react-refresh|src\/|assets\/|node_modules\/)/g, `$1${prefix}/$2`);

  // Chèn <base> nếu là HTML và chưa có
  if (/<head[\s>]/i.test(out) && !/<base\s/i.test(out)) {
    out = out.replace(/<head([^>]*)>/i, `<head$1><base href="${prefix}/">`);
  }

  return out;
}

function shouldRewrite(contentType = '') {
  const ct = contentType.toLowerCase();
  return (
    ct.includes('text/html')
    || ct.includes('text/css')
    || ct.includes('javascript')
    || ct.includes('ecmascript')
    || ct.includes('json')
    || ct.includes('manifest')
    || ct.includes('xml')
  );
}

function decompress(buf, encoding) {
  return new Promise((resolve, reject) => {
    if (!encoding || encoding === 'identity') return resolve(buf);
    if (encoding.includes('gzip')) {
      return zlib.gunzip(buf, (err, out) => (err ? reject(err) : resolve(out)));
    }
    if (encoding.includes('deflate')) {
      return zlib.inflate(buf, (err, out) => (err ? reject(err) : resolve(out)));
    }
    if (encoding.includes('br')) {
      return zlib.brotliDecompress(buf, (err, out) => (err ? reject(err) : resolve(out)));
    }
    return resolve(buf);
  });
}

proxy.on('proxyRes', (proxyRes, req, res) => {
  const machineId = req.dtrMachineId;
  const chunks = [];

  proxyRes.on('data', (chunk) => chunks.push(chunk));
  proxyRes.on('end', async () => {
    try {
      const raw = Buffer.concat(chunks);
      const encoding = String(proxyRes.headers['content-encoding'] || '');
      const contentType = String(proxyRes.headers['content-type'] || '');
      let body = raw;

      if (machineId && shouldRewrite(contentType) && raw.length > 0) {
        const decoded = await decompress(raw, encoding);
        const text = decoded.toString('utf8');
        const rewritten = rewriteAbsolutePaths(text, machineId);
        body = Buffer.from(rewritten, 'utf8');

        // Đã giải nén + rewrite → bỏ content-encoding/length gốc
        const headers = { ...proxyRes.headers };
        delete headers['content-encoding'];
        delete headers['content-length'];
        delete headers['transfer-encoding'];
        headers['content-length'] = String(body.length);

        // Sửa Location tuyệt đối nếu redirect
        if (headers.location && String(headers.location).startsWith('/')) {
          headers.location = `${publicPrefix(machineId)}${headers.location}`;
        }

        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(body);
        return;
      }

      // Không rewrite: stream nguyên headers (trừ hop-by-hop)
      const headers = { ...proxyRes.headers };
      if (headers.location && machineId && String(headers.location).startsWith('/')) {
        headers.location = `${publicPrefix(machineId)}${headers.location}`;
      }
      res.writeHead(proxyRes.statusCode || 200, headers);
      res.end(body);
    } catch (err) {
      console.error('[dtr-proxy] rewrite', err.message);
      if (!res.headersSent) {
        res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      }
      res.end('DTR proxy rewrite error');
    }
  });
});

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
      req.dtrMachineId = parsed.machineId;

      proxy.web(req, res, {
        target: resolved.target,
        ignorePath: false,
        selfHandleResponse: true,
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

      // WS không dùng selfHandleResponse rewrite
      req.url = `${parsed.rest}${url.search}`;
      const wsProxy = httpProxy.createProxyServer({
        xfwd: true,
        changeOrigin: true,
        ws: true,
      });
      wsProxy.on('error', (err) => {
        console.error('[dtr-proxy] ws', err.message);
        socket.destroy();
      });
      wsProxy.ws(req, socket, head, { target: resolved.target });
    } catch (err) {
      console.error('[dtr-proxy] ws', err.message);
      socket.destroy();
    }
  });
}
