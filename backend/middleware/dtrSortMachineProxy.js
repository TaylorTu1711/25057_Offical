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

const wsProxy = httpProxy.createProxyServer({
  xfwd: true,
  changeOrigin: true,
  ws: true,
});

function logProxyError(err, req, res) {
  console.error('[dtr-proxy]', err.message);
  if (res && !res.headersSent && typeof res.writeHead === 'function') {
    res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('DTR proxy error: không kết nối được máy qua Tailscale.');
  }
}

proxy.on('error', logProxyError);
wsProxy.on('error', (err, req, socket) => {
  console.error('[dtr-proxy] ws', err.message);
  if (socket && typeof socket.destroy === 'function') socket.destroy();
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

export function parseDtrEntryPath(pathname) {
  if (isListPath(pathname)) return null;
  const match = pathname.match(/^\/dtr\/sortmachine\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  return {
    machineId: decodeURIComponent(match[1]),
    rest: match[2] && match[2].length > 0 ? match[2] : '/',
  };
}

/** /dtr-p/1007/plc/ws → { port: 1007, rest: /plc/ws } */
export function parseDtrPortPath(pathname) {
  const match = pathname.match(/^\/dtr-p\/(\d{2,5})(\/.*)?$/);
  if (!match) return null;
  const port = Number(match[1]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) return null;
  return {
    port,
    rest: match[2] && match[2].length > 0 ? match[2] : '/',
  };
}

export function isPlenmaReservedPath(pathname) {
  if (isListPath(pathname)) return true;
  if (pathname.startsWith('/dtr/sortmachine/')) return true;
  if (pathname.startsWith('/dtr-p/')) return false;
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
  const maxAge = 60 * 60 * 12;
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

/**
 * Giữ URL /dtr/sortmachine/:id/dashboard trong address bar.
 * App remote chạy trong iframe cùng origin tại /dashboard (cookie proxy).
 */
export function buildFrameShell({ machineId, restPath, query = '' }) {
  const prefix = `/dtr/sortmachine/${encodeURIComponent(machineId)}`;
  const iframeSrc = `${restPath || '/'}${query || ''}`;
  const safePrefix = JSON.stringify(prefix);
  const safeSrc = JSON.stringify(iframeSrc);
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DTR Sort Machine ${String(machineId).replace(/[<>&"]/g, '')}</title>
  <style>
    html,body{margin:0;height:100%;background:#0b1220;overflow:hidden}
    iframe{border:0;width:100%;height:100%;display:block;background:#fff}
  </style>
</head>
<body>
  <iframe id="dtr-frame" title="DTR Sort Machine" src=${safeSrc} allow="fullscreen *; autoplay *"></iframe>
  <script>
  (function () {
    var prefix = ${safePrefix};
    var frame = document.getElementById('dtr-frame');
    var syncing = false;

    function pathFromFrame() {
      try {
        var loc = frame.contentWindow.location;
        if (loc.origin !== location.origin) return null;
        return (loc.pathname || '/') + (loc.search || '') + (loc.hash || '');
      } catch (e) {
        return null;
      }
    }

    function syncParentFromFrame() {
      if (syncing) return;
      var inner = pathFromFrame();
      if (!inner) return;
      var next = prefix + (inner.charAt(0) === '/' ? inner : '/' + inner);
      if (location.pathname + location.search + location.hash === next) return;
      syncing = true;
      try { history.replaceState(null, '', next); } finally { syncing = false; }
    }

    function navigateFrame(pathWithQuery) {
      syncing = true;
      try {
        frame.contentWindow.location.href = pathWithQuery;
      } catch (e) {
        frame.src = pathWithQuery;
      }
      setTimeout(function () { syncing = false; }, 0);
    }

    frame.addEventListener('load', syncParentFromFrame);
    setInterval(syncParentFromFrame, 400);

    window.addEventListener('popstate', function () {
      var rest = location.pathname;
      if (rest.indexOf(prefix) === 0) rest = rest.slice(prefix.length) || '/';
      else return;
      navigateFrame(rest + location.search + location.hash);
    });
  })();
  </script>
</body>
</html>`;
}

/**
 * Mọi http(s)/ws(s) cùng hostname nhưng khác port
 * → cùng origin /dtr-p/<port>/... (tránh Mixed Content).
 */
export function buildClientShim() {
  return `<script data-dtr-shim="1">(function(){
function rewrite(url){
  try{
    var raw=String(url==null?"":url);
    if(!raw||raw.indexOf("blob:")===0||raw.indexOf("data:")===0) return url;
    var u=new URL(raw, location.href);
    if(u.hostname!==location.hostname) return url;
    var port=u.port||(u.protocol==="https:"||u.protocol==="wss:"?"443":"80");
    if(port==="443"||port==="80"||port==="") return url;
    var path="/dtr-p/"+port+(u.pathname||"/")+(u.search||"")+(u.hash||"");
    if(u.protocol==="ws:"||u.protocol==="wss:"){
      return (location.protocol==="https:"?"wss://":"ws://")+location.host+path;
    }
    return location.origin+path;
  }catch(e){return url;}
}
var _fetch=window.fetch;
window.fetch=function(input, init){
  if(typeof input==="string") input=rewrite(input);
  else if(input && typeof input.url==="string") input=new Request(rewrite(input.url), input);
  return _fetch.call(this, input, init);
};
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(){
  var args=Array.prototype.slice.call(arguments);
  if(typeof args[1]==="string") args[1]=rewrite(args[1]);
  return XO.apply(this, args);
};
var OrigWS=window.WebSocket;
function DtrWS(url, protocols){
  var next=rewrite(String(url||""));
  try{
    return protocols===undefined ? new OrigWS(next) : new OrigWS(next, protocols);
  }catch(err){
    console.error("[dtr-shim] WebSocket", next, err);
    throw err;
  }
}
DtrWS.prototype=OrigWS.prototype;
DtrWS.CONNECTING=OrigWS.CONNECTING;
DtrWS.OPEN=OrigWS.OPEN;
DtrWS.CLOSING=OrigWS.CLOSING;
DtrWS.CLOSED=OrigWS.CLOSED;
window.WebSocket=DtrWS;
function hookAttr(proto, attr){
  if(!proto) return;
  var desc=Object.getOwnPropertyDescriptor(proto, attr);
  if(!desc||!desc.set) return;
  Object.defineProperty(proto, attr, {
    configurable:true,
    enumerable:desc.enumerable,
    get:desc.get,
    set:function(v){ return desc.set.call(this, rewrite(v)); }
  });
}
hookAttr(HTMLImageElement&&HTMLImageElement.prototype,"src");
hookAttr(HTMLScriptElement&&HTMLScriptElement.prototype,"src");
hookAttr(HTMLSourceElement&&HTMLSourceElement.prototype,"src");
hookAttr(HTMLMediaElement&&HTMLMediaElement.prototype,"src");
hookAttr(HTMLIFrameElement&&HTMLIFrameElement.prototype,"src");
hookAttr(HTMLLinkElement&&HTMLLinkElement.prototype,"href");
var SA=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(name, value){
  var n=String(name||"").toLowerCase();
  if(n==="src"||n==="href"||n==="poster"||n==="data") value=rewrite(value);
  return SA.call(this, name, value);
};
})();</script>`;
}

export function rewriteHtml(content) {
  if (!/<head[\s>]/i.test(content)) return content;
  if (/data-dtr-shim=/i.test(content)) return content;
  return content.replace(/<head([^>]*)>/i, `<head$1>${buildClientShim()}`);
}

function shouldRewrite(contentType = '') {
  return String(contentType).toLowerCase().includes('text/html');
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
        const rewritten = rewriteHtml(decoded.toString('utf8'));
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

async function resolveMachineTarget(machineId, pathname = '/', forcedPort = null) {
  const machine = await getDtrSortMachineById(machineId);
  if (!machine) return { errorStatus: 404, error: 'Không tìm thấy máy' };

  const frontPort = Number(machine.port) > 0 ? Number(machine.port) : 5173;
  const apiPort = machine.api_port != null ? Number(machine.api_port) : null;

  let port = frontPort;
  if (forcedPort != null) {
    port = forcedPort;
  } else if (apiPort && isDtrApiPath(pathname)) {
    port = apiPort;
  }

  return {
    machine,
    target: `http://${machine.tailscale_ip}:${port}`,
  };
}

function proxyWeb(req, res, target) {
  const queryIdx = req.url.indexOf('?');
  // req.url already set by caller when path rewritten
  proxy.web(req, res, {
    target,
    ignorePath: false,
    selfHandleResponse: true,
  });
}

/**
 * 1) /dtr/sortmachine → clear cookie
 * 2) /dtr/sortmachine/:id/... → cookie + shell iframe (URL giữ prefix)
 * 3) /dtr-p/:port/... → proxy tới Tailscale IP:port (cần cookie)
 * 4) cookie → proxy path gốc tới frontend/api port máy
 */
export function dtrSortMachineProxy(req, res, next) {
  const pathname = req.path || '/';
  const cookies = parseCookies(req.headers.cookie);
  const machineId = cookies[DTR_MACHINE_COOKIE];

  if (isListPath(pathname)) {
    clearMachineCookie(req, res);
    return next();
  }

  const entry = parseDtrEntryPath(pathname);
  if (entry) {
    const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    getDtrSortMachineById(entry.machineId)
      .then((machine) => {
        if (!machine) {
          res.status(404).type('text').send('Không tìm thấy máy');
          return;
        }
        setMachineCookie(req, res, entry.machineId);
        res
          .status(200)
          .set({
            'Content-Type': 'text/html; charset=utf-8',
            'Cache-Control': 'no-store',
          })
          .send(
            buildFrameShell({
              machineId: entry.machineId,
              restPath: entry.rest || '/',
              query,
            }),
          );
      })
      .catch((err) => {
        console.error('[dtr-proxy] shell', err.message);
        res.status(500).type('text').send('DTR shell error');
      });
    return;
  }

  const portPath = parseDtrPortPath(pathname);
  if (portPath) {
    if (!machineId) {
      res.status(401).type('text').send('Thiếu cookie máy DTR — mở lại từ /dtr/sortmachine/<id>/');
      return;
    }
    const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
    req.url = `${portPath.rest}${q}`;
    resolveMachineTarget(machineId, portPath.rest, portPath.port)
      .then((resolved) => {
        if (resolved.errorStatus) {
          res.status(resolved.errorStatus).type('text').send(resolved.error);
          return;
        }
        proxyWeb(req, res, resolved.target);
      })
      .catch((err) => {
        console.error('[dtr-proxy] port', err.message);
        res.status(500).type('text').send('DTR port proxy error');
      });
    return;
  }

  if (!machineId) return next();
  if (isPlenmaReservedPath(pathname)) return next();

  resolveMachineTarget(machineId, pathname)
    .then((resolved) => {
      if (resolved.errorStatus) {
        res.status(resolved.errorStatus).type('text').send(resolved.error);
        return;
      }
      proxyWeb(req, res, resolved.target);
    })
    .catch((err) => {
      console.error('[dtr-proxy] lookup', err.message);
      res.status(500).type('text').send('DTR proxy lookup error');
    });
}

export function attachDtrSortMachineWsProxy(server) {
  server.on('upgrade', async (req, socket, head) => {
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url || '/', `http://${host}`);
      const cookies = parseCookies(req.headers.cookie);
      let machineId = cookies[DTR_MACHINE_COOKIE];

      const portPath = parseDtrPortPath(url.pathname);
      if (portPath) {
        if (!machineId) {
          socket.destroy();
          return;
        }
        const resolved = await resolveMachineTarget(machineId, portPath.rest, portPath.port);
        if (resolved.errorStatus) {
          socket.destroy();
          return;
        }
        req.url = `${portPath.rest}${url.search}`;
        wsProxy.ws(req, socket, head, { target: resolved.target });
        return;
      }

      const entry = parseDtrEntryPath(url.pathname);
      if (entry) machineId = entry.machineId;
      if (!machineId) return;
      if (isPlenmaReservedPath(url.pathname) && !entry) return;

      const pathname = entry ? entry.rest : url.pathname;
      const resolved = await resolveMachineTarget(machineId, pathname);
      if (resolved.errorStatus) {
        socket.destroy();
        return;
      }
      if (entry) req.url = `${entry.rest}${url.search}`;
      wsProxy.ws(req, socket, head, { target: resolved.target });
    } catch (err) {
      console.error('[dtr-proxy] ws', err.message);
      socket.destroy();
    }
  });
}
