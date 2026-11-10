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

export function machinePrefix(machineId) {
  return `/dtr/sortmachine/${encodeURIComponent(machineId)}`;
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

const STATIC_ASSET_RE =
  /\.(?:js|mjs|cjs|css|map|json|wasm|ico|png|jpe?g|gif|svg|webp|woff2?|ttf|eot|mp4|webm|txt|xml)$/i;

function isStaticAssetPath(pathname = '') {
  if (pathname.startsWith('/assets/')) return true;
  if (pathname.startsWith('/static/')) return true;
  if (pathname.startsWith('/@') || pathname.startsWith('/node_modules/')) return true;
  return STATIC_ASSET_RE.test(pathname.split('?')[0]);
}

/** Chỉ navigation document mới ra shell/redirect — không được bắt /assets/*.js (Accept: */*). */
function isDocumentNavigation(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const pathname = req.path || '/';
  if (isStaticAssetPath(pathname)) return false;

  const dest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  if (dest && dest !== 'document' && dest !== 'iframe') return false;

  const accept = String(req.headers.accept || '');
  if (dest === 'document') return true;
  if (accept.includes('text/html')) return true;
  return false;
}

function isEmbedRequest(req) {
  const dest = String(req.headers['sec-fetch-dest'] || '').toLowerCase();
  if (dest === 'iframe') return true;
  const q = req.url.includes('?') ? req.url.slice(req.url.indexOf('?') + 1) : '';
  return new URLSearchParams(q).get('dtr_embed') === '1';
}

/**
 * Shell: address bar = /dtr/sortmachine/:id/dashboard
 * iframe cùng origin load /dashboard (React Router đúng path).
 */
export function buildFrameShell({ machineId, restPath, query = '' }) {
  const prefix = machinePrefix(machineId);
  const params = new URLSearchParams(
    query.startsWith('?') ? query.slice(1) : query,
  );
  params.set('dtr_embed', '1');
  const iframeSrc = `${restPath || '/'}?${params.toString()}`;
  const safePrefix = JSON.stringify(prefix);
  const safeSrc = JSON.stringify(iframeSrc);
  const safeId = String(machineId).replace(/[<>&"]/g, '');
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DTR Sort Machine ${safeId}</title>
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
        var path = loc.pathname || '/';
        var search = loc.search || '';
        search = search.replace(/([?&])dtr_embed=1(&|$)/, function(_, a, b) {
          return b === '&' ? a : '';
        }).replace(/[?&]$/, '');
        return path + search + (loc.hash || '');
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
      var url = pathWithQuery || '/';
      var join = url.indexOf('?') >= 0 ? '&' : '?';
      if (url.indexOf('dtr_embed=') < 0) url = url + join + 'dtr_embed=1';
      try { frame.contentWindow.location.href = url; }
      catch (e) { frame.src = url; }
      setTimeout(function () { syncing = false; }, 0);
    }

    frame.addEventListener('load', syncParentFromFrame);
    setInterval(syncParentFromFrame, 300);

    window.addEventListener('popstate', function () {
      var rest = location.pathname;
      if (rest.indexOf(prefix) === 0) rest = rest.slice(prefix.length) || '/';
      else return;
      navigateFrame(rest + location.search + location.hash);
    });

    window.addEventListener('message', function (ev) {
      if (ev.origin !== location.origin) return;
      var data = ev.data;
      if (!data || data.type !== 'dtr-navigate' || typeof data.path !== 'string') return;
      var path = data.path.charAt(0) === '/' ? data.path : '/' + data.path;
      var next = prefix + path;
      if (location.pathname + location.search + location.hash !== next) {
        history.replaceState(null, '', next);
      }
    });
  })();
  </script>
</body>
</html>`;
}

/**
 * Shim trong iframe (path thật /dashboard):
 * - rewrite port khác → /dtr-p/:port
 * - chặn breakout ra top-level /dashboard
 * - báo parent path để address bar = /dtr/sortmachine/:id/...
 */
export function buildClientShim(prefix) {
  const p = JSON.stringify(prefix || '');
  return `<script data-dtr-shim="1">(function(){
var PREFIX=${p};
function rewrite(url){
  try{
    var raw=String(url==null?"":url);
    if(!raw||raw.indexOf("blob:")===0||raw.indexOf("data:")===0||raw.indexOf("mailto:")===0||raw.indexOf("javascript:")===0) return url;
    var u=new URL(raw, location.href);
    if(u.hostname!==location.hostname) return url;
    var port=u.port||(u.protocol==="https:"||u.protocol==="wss:"?"443":"80");
    if(port!=="443"&&port!=="80"&&port!==""){
      var path="/dtr-p/"+port+(u.pathname||"/")+(u.search||"")+(u.hash||"");
      if(u.protocol==="ws:"||u.protocol==="wss:"){
        return (location.protocol==="https:"?"wss://":"ws://")+location.host+path;
      }
      return location.origin+path;
    }
    return url;
  }catch(e){return url;}
}
var _fetch=window.fetch;
window.fetch=function(input, init){
  if(typeof input==="string") input=rewrite(input);
  else if(input&&typeof input.url==="string") input=new Request(rewrite(input.url), input);
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
  try{ return protocols===undefined ? new OrigWS(next) : new OrigWS(next, protocols); }
  catch(err){ console.error("[dtr-shim] WebSocket", next, err); throw err; }
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
    configurable:true, enumerable:desc.enumerable, get:desc.get,
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
  if(n==="src"||n==="href"||n==="poster"||n==="data"||n==="action") value=rewrite(value);
  if(n==="target" && (value==="_top"||value==="_parent")) value="_self";
  return SA.call(this, name, value);
};
document.addEventListener("click",function(e){
  var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
  if(!a) return;
  if(a.target==="_top"||a.target==="_parent") a.target="_self";
  var href=a.getAttribute("href");
  if(href){
    var next=rewrite(href);
    if(next!==href) a.setAttribute("href", next);
  }
},true);
if(window.top!==window){
  function notifyParent(){
    try{
      var path=(location.pathname||"/")+(location.search||"").replace(/([?&])dtr_embed=1(&|$)/,function(_,a,b){return b==="&"?a:"";}).replace(/[?&]$/,"")+(location.hash||"");
      window.parent.postMessage({type:"dtr-navigate", path:path}, location.origin);
    }catch(e){}
  }
  var _push=history.pushState.bind(history);
  var _replace=history.replaceState.bind(history);
  history.pushState=function(s,t,u){ var r=_push(s,t,u); notifyParent(); return r; };
  history.replaceState=function(s,t,u){ var r=_replace(s,t,u); notifyParent(); return r; };
  window.addEventListener("popstate", notifyParent);
  setInterval(notifyParent, 500);
}
})();</script>`;
}

export function rewriteHtml(content, prefix) {
  if (!/<head[\s>]/i.test(content)) return content;
  if (/data-dtr-shim=/i.test(content)) return content;
  return content.replace(/<head([^>]*)>/i, `<head$1>${buildClientShim(prefix)}`);
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
        const rewritten = rewriteHtml(decoded.toString('utf8'), req.dtrPrefix || '');
        body = Buffer.from(rewritten, 'utf8');
        const headers = { ...proxyRes.headers };
        delete headers['content-encoding'];
        delete headers['content-length'];
        delete headers['transfer-encoding'];
        // Cho phép embed cùng origin
        delete headers['x-frame-options'];
        if (headers['content-security-policy']) {
          headers['content-security-policy'] = String(headers['content-security-policy'])
            .replace(/frame-ancestors[^;]*;?/gi, '');
        }
        headers['content-length'] = String(body.length);
        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(body);
        return;
      }

      const headers = { ...proxyRes.headers };
      delete headers['x-frame-options'];
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

function proxyWeb(req, res, target, prefix) {
  req.dtrPrefix = prefix || '';
  proxy.web(req, res, {
    target,
    ignorePath: false,
    selfHandleResponse: true,
  });
}

function redirectToMachinePath(res, machineId, pathname, query = '') {
  const rest = !pathname || pathname === '/' ? '/' : pathname;
  const params = new URLSearchParams(
    query.startsWith('?') ? query.slice(1) : query,
  );
  params.delete('dtr_embed');
  const q = params.toString();
  res.redirect(302, `${machinePrefix(machineId)}${rest}${q ? `?${q}` : ''}`);
}

/**
 * 1) /dtr/sortmachine → clear cookie (SPA list)
 * 2) /dtr/sortmachine/:id/... HTML → shell (URL giữ prefix); embed → proxy
 * 3) /dtr-p/:port/... → port phụ
 * 4) cookie + HTML top-level /dashboard → 302 về prefix
 * 5) cookie + iframe/assets → proxy
 */
export function dtrSortMachineProxy(req, res, next) {
  const pathname = req.path || '/';
  const cookies = parseCookies(req.headers.cookie);
  const machineId = cookies[DTR_MACHINE_COOKIE];
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';

  if (isListPath(pathname)) {
    clearMachineCookie(req, res);
    return next();
  }

  const entry = parseDtrEntryPath(pathname);
  if (entry) {
    const prefix = machinePrefix(entry.machineId);
    const embed = isEmbedRequest(req);

    if (isDocumentNavigation(req) && !embed) {
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

    setMachineCookie(req, res, entry.machineId);
    // Bỏ dtr_embed khỏi query trước khi proxy sang máy
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : '');
    params.delete('dtr_embed');
    const cleanQ = params.toString();
    req.url = `${entry.rest}${cleanQ ? `?${cleanQ}` : ''}`;
    resolveMachineTarget(entry.machineId, entry.rest)
      .then((resolved) => {
        if (resolved.errorStatus) {
          res.status(resolved.errorStatus).type('text').send(resolved.error);
          return;
        }
        proxyWeb(req, res, resolved.target, prefix);
      })
      .catch((err) => {
        console.error('[dtr-proxy] entry', err.message);
        res.status(500).type('text').send('DTR proxy error');
      });
    return;
  }

  const portPath = parseDtrPortPath(pathname);
  if (portPath) {
    if (!machineId) {
      res.status(401).type('text').send('Thiếu cookie máy DTR — mở lại từ /dtr/sortmachine/<id>/');
      return;
    }
    req.url = `${portPath.rest}${query}`;
    resolveMachineTarget(machineId, portPath.rest, portPath.port)
      .then((resolved) => {
        if (resolved.errorStatus) {
          res.status(resolved.errorStatus).type('text').send(resolved.error);
          return;
        }
        proxyWeb(req, res, resolved.target, machinePrefix(machineId));
      })
      .catch((err) => {
        console.error('[dtr-proxy] port', err.message);
        res.status(500).type('text').send('DTR port proxy error');
      });
    return;
  }

  if (!machineId) return next();
  if (isPlenmaReservedPath(pathname)) return next();

  // Top-level /dashboard → luôn về URL có prefix (address bar đúng)
  // Asset /assets/*.js phải proxy thẳng — không redirect/shell (tránh MIME text/html)
  if (isDocumentNavigation(req) && !isEmbedRequest(req)) {
    redirectToMachinePath(res, machineId, pathname, query);
    return;
  }

  resolveMachineTarget(machineId, pathname)
    .then((resolved) => {
      if (resolved.errorStatus) {
        res.status(resolved.errorStatus).type('text').send(resolved.error);
        return;
      }
      proxyWeb(req, res, resolved.target, machinePrefix(machineId));
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
      if (entry) {
        machineId = entry.machineId;
        const resolved = await resolveMachineTarget(machineId, entry.rest);
        if (resolved.errorStatus) {
          socket.destroy();
          return;
        }
        req.url = `${entry.rest}${url.search}`;
        wsProxy.ws(req, socket, head, { target: resolved.target });
        return;
      }

      if (!machineId) return;
      if (isPlenmaReservedPath(url.pathname)) return;

      const resolved = await resolveMachineTarget(machineId, url.pathname);
      if (resolved.errorStatus) {
        socket.destroy();
        return;
      }
      wsProxy.ws(req, socket, head, { target: resolved.target });
    } catch (err) {
      console.error('[dtr-proxy] ws', err.message);
      socket.destroy();
    }
  });
}
