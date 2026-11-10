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

function wantsHtml(req) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false;
  const accept = String(req.headers.accept || '');
  if (!accept || accept === '*/*') return true;
  return accept.includes('text/html');
}

/**
 * Shim: giữ mọi URL dưới /dtr/sortmachine/:id/...
 * - pathname getter → strip prefix (React Router thấy /dashboard)
 * - pushState/replaceState → thêm prefix (address bar đúng)
 * - fetch/XHR/WS/img + absolute /path → prefix hoặc /dtr-p/:port
 */
export function buildClientShim(prefix) {
  const p = JSON.stringify(prefix);
  return `<script data-dtr-shim="1">(function(){
var PREFIX=${p};
function stripPath(path){
  if(!path) return "/";
  if(path.indexOf(PREFIX)===0) return path.slice(PREFIX.length)||"/";
  return path;
}
function withPrefix(url){
  if(url==null) return url;
  var raw=String(url);
  if(!raw||raw.charAt(0)==="#") return url;
  if(raw.indexOf("blob:")===0||raw.indexOf("data:")===0||raw.indexOf("mailto:")===0||raw.indexOf("javascript:")===0) return url;
  try{
    var u=new URL(raw, location.href);
    if(u.hostname!==location.hostname) return url;
    var port=u.port||(u.protocol==="https:"||u.protocol==="wss:"?"443":"80");
    if(port!=="443"&&port!=="80"&&port!==""){
      var aport="/dtr-p/"+port+(u.pathname||"/")+(u.search||"")+(u.hash||"");
      if(u.protocol==="ws:"||u.protocol==="wss:"){
        return (location.protocol==="https:"?"wss://":"ws://")+location.host+aport;
      }
      return location.origin+aport;
    }
    var path=u.pathname||"/";
    if(path.indexOf(PREFIX)!==0 && path.indexOf("/dtr-p/")!==0 && path.indexOf("/dtr/sortmachine")!==0){
      path=PREFIX+(path.charAt(0)==="/" ? path : "/"+path);
    }
    if(u.protocol==="ws:"||u.protocol==="wss:"){
      return (location.protocol==="https:"?"wss://":"ws://")+location.host+path+(u.search||"")+(u.hash||"");
    }
    if(/^https?:/i.test(raw)||raw.indexOf("//")===0){
      return location.origin+path+(u.search||"")+(u.hash||"");
    }
    return path+(u.search||"")+(u.hash||"");
  }catch(e){return url;}
}
try{
  var locDesc=Object.getOwnPropertyDescriptor(Location.prototype,"pathname");
  if(locDesc&&locDesc.get){
    Object.defineProperty(Location.prototype,"pathname",{
      configurable:true,
      enumerable:true,
      get:function(){ return stripPath(locDesc.get.call(this)); }
    });
  }
}catch(e){}
var _push=history.pushState.bind(history);
var _replace=history.replaceState.bind(history);
history.pushState=function(state,title,url){ return _push(state,title,url==null?url:withPrefix(url)); };
history.replaceState=function(state,title,url){ return _replace(state,title,url==null?url:withPrefix(url)); };
var _assign=Location.prototype.assign;
Location.prototype.assign=function(url){ return _assign.call(this, withPrefix(url)); };
var _replaceLoc=Location.prototype.replace;
Location.prototype.replace=function(url){ return _replaceLoc.call(this, withPrefix(url)); };
document.addEventListener("click",function(e){
  var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
  if(!a) return;
  var href=a.getAttribute("href");
  if(!href) return;
  var next=withPrefix(href);
  if(next!==href) a.setAttribute("href", next);
},true);
var _fetch=window.fetch;
window.fetch=function(input, init){
  if(typeof input==="string") input=withPrefix(input);
  else if(input&&typeof input.url==="string") input=new Request(withPrefix(input.url), input);
  return _fetch.call(this, input, init);
};
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(){
  var args=Array.prototype.slice.call(arguments);
  if(typeof args[1]==="string") args[1]=withPrefix(args[1]);
  return XO.apply(this, args);
};
var OrigWS=window.WebSocket;
function DtrWS(url, protocols){
  var next=withPrefix(String(url||""));
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
    set:function(v){ return desc.set.call(this, withPrefix(v)); }
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
  if(n==="src"||n==="href"||n==="poster"||n==="data"||n==="action") value=withPrefix(value);
  return SA.call(this, name, value);
};
})();</script>`;
}

export function rewriteHtml(content, prefix) {
  if (!prefix) return content;
  let html = content;
  if (/<head[\s>]/i.test(html) && !/data-dtr-shim=/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${buildClientShim(prefix)}`);
  }
  // Absolute asset/routes in HTML → under machine prefix
  html = html.replace(
    /\b(src|href|action)=(["'])\/(?!\/|dtr\/sortmachine|dtr-p\/)/gi,
    `$1=$2${prefix}/`,
  );
  return html;
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
  res.redirect(302, `${machinePrefix(machineId)}${rest}${query}`);
}

/**
 * 1) /dtr/sortmachine → clear cookie (SPA list)
 * 2) /dtr/sortmachine/:id/... → proxy Tailscale (URL giữ prefix)
 * 3) /dtr-p/:port/... → port phụ (cookie)
 * 4) cookie + /dashboard|/online|... → 302 về /dtr/sortmachine/:id/...
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
    setMachineCookie(req, res, entry.machineId);
    const prefix = machinePrefix(entry.machineId);
    req.url = `${entry.rest}${query}`;
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

  // Không cho tồn tại URL trần /dashboard — luôn về prefix
  if (wantsHtml(req)) {
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
