import httpProxy from 'http-proxy';
import zlib from 'zlib';
import {
  getDtrSortMachineById,
  isDtrApiPath,
} from '../utils/dtrSortMachines.js';

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

function isListPath(pathname) {
  return pathname === '/dtr/sortmachine' || pathname === '/dtr/sortmachine/';
}

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

/** Script chèn vào HTML: giữ subpath + đổi http://host:apiPort → HTTPS cùng origin. */
export function buildClientShim(machineId, apiPort) {
  const prefix = publicPrefix(machineId);
  const apiPortJson = apiPort == null ? 'null' : String(Number(apiPort));
  return `<script data-dtr-shim="1">(function(){
var PREFIX=${JSON.stringify(prefix)};
var API_PORT=${apiPortJson};
function keepPrefix(url){
  try{
    if(typeof url!=="string") return url;
    if(url.startsWith("http://")||url.startsWith("https://")||url.startsWith("ws://")||url.startsWith("wss://")||url.startsWith("//")) return url;
    if(url.startsWith(PREFIX)) return url;
    if(url.startsWith("/")) return PREFIX+url;
    return url;
  }catch(e){return url;}
}
function rewriteApi(url){
  try{
    if(API_PORT==null) return url;
    var u=new URL(url, location.href);
    var hostOk=u.hostname===location.hostname;
    var portOk=String(u.port||"")===String(API_PORT)
      || (u.protocol==="http:" && String(API_PORT)==="80")
      || (u.protocol==="ws:" && String(API_PORT)==="80");
    if(hostOk && portOk){
      var path=(u.pathname||"/")+(u.search||"")+(u.hash||"");
      if(u.protocol==="ws:" || u.protocol==="wss:"){
        return (location.protocol==="https:"?"wss://":"ws://")+location.host+PREFIX+path;
      }
      return location.origin+PREFIX+path;
    }
    return url;
  }catch(e){return url;}
}
function rewrite(url){ return rewriteApi(keepPrefix(String(url||""))); }
var _fetch=window.fetch;
window.fetch=function(input, init){
  if(typeof input==="string") input=rewrite(input);
  else if(input && typeof input.url==="string") input=new Request(rewrite(input.url), input);
  return _fetch.call(this, input, init);
};
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(method, url){
  var args=Array.prototype.slice.call(arguments);
  if(typeof args[1]==="string") args[1]=rewrite(args[1]);
  return XO.apply(this, args);
};
var OrigWS=window.WebSocket;
function DtrWS(url, protocols){
  var next=rewrite(String(url||""));
  if(protocols===undefined) return new OrigWS(next);
  return new OrigWS(next, protocols);
}
DtrWS.prototype=OrigWS.prototype;
DtrWS.CONNECTING=OrigWS.CONNECTING;
DtrWS.OPEN=OrigWS.OPEN;
DtrWS.CLOSING=OrigWS.CLOSING;
DtrWS.CLOSED=OrigWS.CLOSED;
window.WebSocket=DtrWS;
function wrapHistory(fn){
  return function(state, title, url){
    if(typeof url==="string") url=keepPrefix(url);
    return fn.call(this, state, title, url);
  };
}
history.pushState=wrapHistory(history.pushState.bind(history));
history.replaceState=wrapHistory(history.replaceState.bind(history));
document.addEventListener("click", function(e){
  var a=e.target && e.target.closest ? e.target.closest("a[href]") : null;
  if(!a) return;
  var href=a.getAttribute("href");
  if(!href || href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) return;
  if(href.startsWith("http://")||href.startsWith("https://")||href.startsWith("//")) return;
  if(href.startsWith(PREFIX) || !href.startsWith("/")) return;
  e.preventDefault();
  history.pushState(null, "", PREFIX+href);
  window.dispatchEvent(new PopStateEvent("popstate"));
}, true);
})();</script>`;
}

export function rewriteAbsolutePaths(content, machineId, apiPort = null) {
  const prefix = publicPrefix(machineId);
  let out = content;

  out = out.replace(
    /((?:href|src|action|content)=["'])\/(?!\/)/gi,
    `$1${prefix}/`,
  );
  out = out.replace(/url\(\s*['"]?\/(?!\/)/gi, (m) => m.replace('/', `${prefix}/`));
  out = out.replace(/((?:from|import)\s+["'])\/(?!\/)/g, `$1${prefix}/`);
  out = out.replace(/(["'`])\/(@vite|@react-refresh|src\/|assets\/|node_modules\/)/g, `$1${prefix}/$2`);

  if (/<head[\s>]/i.test(out)) {
    if (!/<base\s/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1><base href="${prefix}/">`);
    }
    if (!/data-dtr-shim=/i.test(out)) {
      out = out.replace(/<head([^>]*)>/i, `<head$1>${buildClientShim(machineId, apiPort)}`);
    }
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
  const apiPort = req.dtrApiPort;
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
        const rewritten = rewriteAbsolutePaths(text, machineId, apiPort);
        body = Buffer.from(rewritten, 'utf8');

        const headers = { ...proxyRes.headers };
        delete headers['content-encoding'];
        delete headers['content-length'];
        delete headers['transfer-encoding'];
        headers['content-length'] = String(body.length);

        if (headers.location && String(headers.location).startsWith('/')) {
          headers.location = `${publicPrefix(machineId)}${headers.location}`;
        }

        res.writeHead(proxyRes.statusCode || 200, headers);
        res.end(body);
        return;
      }

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

async function resolveTarget(machineId, restPath = '/') {
  const machine = await getDtrSortMachineById(machineId);
  if (!machine) return { errorStatus: 404, error: 'Không tìm thấy máy' };

  const frontPort = Number(machine.port) > 0 ? Number(machine.port) : 5173;
  const apiPort = machine.api_port != null ? Number(machine.api_port) : null;
  const useApi = apiPort && isDtrApiPath(restPath);
  const port = useApi ? apiPort : frontPort;

  return {
    machine,
    apiPort,
    target: `http://${machine.tailscale_ip}:${port}`,
  };
}

export function dtrSortMachineProxy(req, res, next) {
  const parsed = parseDtrProxyPath(req.path);
  if (!parsed) return next();

  resolveTarget(parsed.machineId, parsed.rest)
    .then((resolved) => {
      if (resolved.errorStatus) {
        res.status(resolved.errorStatus).type('text').send(resolved.error);
        return;
      }

      const queryIdx = req.url.indexOf('?');
      const query = queryIdx >= 0 ? req.url.slice(queryIdx) : '';
      req.url = `${parsed.rest}${query}`;
      req.dtrMachineId = parsed.machineId;
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

export function attachDtrSortMachineWsProxy(server) {
  server.on('upgrade', async (req, socket, head) => {
    try {
      const host = req.headers.host || 'localhost';
      const url = new URL(req.url || '/', `http://${host}`);
      const parsed = parseDtrProxyPath(url.pathname);
      if (!parsed) return;

      const resolved = await resolveTarget(parsed.machineId, parsed.rest);
      if (resolved.errorStatus) {
        socket.destroy();
        return;
      }

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
