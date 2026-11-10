import httpProxy from 'http-proxy';
import zlib from 'zlib';
import {
  getDtrSortMachineById,
  isDtrApiPath,
} from '../utils/dtrSortMachines.js';

export const DTR_MACHINE_COOKIE = 'dtr_machine';

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

function parseCookies(header = '') {
  const out = {};
  String(header)
    .split(';')
    .forEach((part) => {
      const idx = part.indexOf('=');
      if (idx < 0) return;
      const k = part.slice(0, idx).trim();
      const v = part.slice(idx + 1).trim();
      if (k) out[k] = decodeURIComponent(v);
    });
  return out;
}

function isListPath(pathname) {
  return pathname === '/dtr/sortmachine' || pathname === '/dtr/sortmachine/';
}

/** /dtr/sortmachine/:id[/rest...] */
export function parseDtrEntryPath(pathname) {
  if (isListPath(pathname)) return null;
  const match = pathname.match(/^\/dtr\/sortmachine\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  return {
    machineId: decodeURIComponent(match[1]),
    rest: match[2] && match[2].length > 0 ? match[2] : '/',
  };
}

/** Path thuộc SCADA chính — không proxy sang máy sort dù có cookie. */
export function isPlenmaReservedPath(pathname) {
  if (isListPath(pathname)) return true;
  if (pathname.startsWith('/dtr/sortmachine/')) return true; // entry xử lý riêng
  if (pathname.startsWith('/api/')) return true;
  if (pathname.startsWith('/uploads/')) return true;
  if (pathname.startsWith('/login')) return true;
  if (pathname.startsWith('/register')) return true;
  if (pathname.startsWith('/mida')) return true;
  if (pathname.startsWith('/machines')) return true;
  return false;
}

function isHttpsRequest(req) {
  return Boolean(req.secure || req.headers['x-forwarded-proto'] === 'https');
}

function setMachineCookie(req, res, machineId) {
  const maxAge = 60 * 60 * 12; // 12h
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${DTR_MACHINE_COOKIE}=${encodeURIComponent(machineId)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`,
  );
}

function clearMachineCookie(req, res) {
  const secure = isHttpsRequest(req) ? '; Secure' : '';
  res.setHeader(
    'Set-Cookie',
    `${DTR_MACHINE_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`,
  );
}

/** Shim nhẹ: chỉ sửa ws/http :apiPort → cùng origin (pathname đã là /online). */
export function buildClientShim(apiPort) {
  const apiPortJson = apiPort == null ? 'null' : String(Number(apiPort));
  return `<script data-dtr-shim="1">(function(){
var API_PORT=${apiPortJson};
function rewriteApi(url){
  try{
    if(API_PORT==null) return url;
    var u=new URL(url, location.href);
    if(u.hostname!==location.hostname) return url;
    var portOk=String(u.port||"")===String(API_PORT)
      || (u.protocol==="http:" && String(API_PORT)==="80")
      || (u.protocol==="ws:" && String(API_PORT)==="80");
    if(!portOk) return url;
    var path=(u.pathname||"/")+(u.search||"")+(u.hash||"");
    if(u.protocol==="ws:"||u.protocol==="wss:"){
      return (location.protocol==="https:"?"wss://":"ws://")+location.host+path;
    }
    return location.origin+path;
  }catch(e){return url;}
}
var _fetch=window.fetch;
window.fetch=function(input, init){
  if(typeof input==="string") input=rewriteApi(input);
  else if(input && typeof input.url==="string") input=new Request(rewriteApi(input.url), input);
  return _fetch.call(this, input, init);
};
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(){
  var args=Array.prototype.slice.call(arguments);
  if(typeof args[1]==="string") args[1]=rewriteApi(args[1]);
  return XO.apply(this, args);
};
var OrigWS=window.WebSocket;
function DtrWS(url, protocols){
  var next=rewriteApi(String(url||""));
  return protocols===undefined ? new OrigWS(next) : new OrigWS(next, protocols);
}
DtrWS.prototype=OrigWS.prototype;
DtrWS.CONNECTING=OrigWS.CONNECTING;
DtrWS.OPEN=OrigWS.OPEN;
DtrWS.CLOSING=OrigWS.CLOSING;
DtrWS.CLOSED=OrigWS.CLOSED;
window.WebSocket=DtrWS;
})();</script>`;
}

export function rewriteHtml(content, apiPort) {
  if (!/<head[\s>]/i.test(content)) return content;
  if (/data-dtr-shim=/i.test(content)) return content;
  return content.replace(/<head([^>]*)>/i, `<head$1>${buildClientShim(apiPort)}`);
}

function shouldRewrite(contentType = '') {
  const ct = contentType.toLowerCase();
  return ct.includes('text/html');
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
  const apiPort = req.dtrApiPort;
  const chunks = [];
  proxyRes.on('data', (chunk) => chunks.push(chunk));
  proxyRes.on('end', async () => {
    try {
      const raw = Buffer.concat(chunks);
      const encoding = String(proxyRes.headers['content-encoding'] || '');
      const contentType = String(proxyRes.headers['content-type'] || '');
      let body = raw;

      if (shouldRewrite(contentType) && raw.length > 0) {
        const decoded = await decompress(raw, encoding);
        const rewritten = rewriteHtml(decoded.toString('utf8'), apiPort);
        body = Buffer.from(rewritten, 'utf8');
        const headers = { ...proxyRes.headers };
        delete headers['content-encoding'];
        delete headers['content-length'];
        delete headers['transfer-encoding'];
        headers['content-length'] = String(body.length);
        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(body);
        return;
      }

      res.writeHead(proxyRes.statusCode || 200, proxyRes.headers);
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

async function resolveTarget(machineId, pathname = '/') {
  const machine = await getDtrSortMachineById(machineId);
  if (!machine) return { errorStatus: 404, error: 'Không tìm thấy máy' };
  const frontPort = Number(machine.port) > 0 ? Number(machine.port) : 5173;
  const apiPort = machine.api_port != null ? Number(machine.api_port) : null;
  const useApi = apiPort && isDtrApiPath(pathname);
  const port = useApi ? apiPort : frontPort;
  return {
    machine,
    apiPort,
    target: `http://${machine.tailscale_ip}:${port}`,
  };
}

function proxyToMachine(req, res, machineId, pathnameForPort) {
  resolveTarget(machineId, pathnameForPort)
    .then((resolved) => {
      if (resolved.errorStatus) {
        res.status(resolved.errorStatus).type('text').send(resolved.error);
        return;
      }
      req.dtrApiPort = resolved.apiPort;
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

/**
 * 1) /dtr/sortmachine → xoá cookie (SPA list)
 * 2) /dtr/sortmachine/:id/... → set cookie + 302 về /online|/dashboard|/
 * 3) Có cookie → proxy path gốc sang máy Tailscale (React Router khớp pathname)
 */
export function dtrSortMachineProxy(req, res, next) {
  const pathname = req.path || '/';
  const cookies = parseCookies(req.headers.cookie);

  if (isListPath(pathname)) {
    clearMachineCookie(req, res);
    return next();
  }

  const entry = parseDtrEntryPath(pathname);
  if (entry) {
    setMachineCookie(req, res, entry.machineId);
    const dest = `${entry.rest}${req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : ''}`;
    res.redirect(302, dest);
    return;
  }

  const machineId = cookies[DTR_MACHINE_COOKIE];
  if (!machineId) return next();
  if (isPlenmaReservedPath(pathname)) return next();

  proxyToMachine(req, res, machineId, pathname);
}

export function attachDtrSortMachineWsProxy(server) {
  server.on('upgrade', async (req, socket, head) => {
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url || '/', `http://${host}`);
      const cookies = parseCookies(req.headers.cookie);
      let machineId = cookies[DTR_MACHINE_COOKIE];

      const entry = parseDtrEntryPath(url.pathname);
      if (entry) machineId = entry.machineId;

      if (!machineId) return;
      if (isPlenmaReservedPath(url.pathname) && !entry) return;

      const pathname = entry ? entry.rest : url.pathname;
      const resolved = await resolveTarget(machineId, pathname);
      if (resolved.errorStatus) {
        socket.destroy();
        return;
      }

      if (entry) {
        req.url = `${entry.rest}${url.search}`;
      }

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
