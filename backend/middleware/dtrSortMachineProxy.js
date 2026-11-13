import httpProxy from 'http-proxy';
import zlib from 'zlib';
import {
  getDtrSortMachineById,
  isDtrApiPath,
} from '../utils/dtrSortMachines.js';

export const DTR_MACHINE_COOKIE = 'dtr_machine';

/**
 * Route SPA máy sort — iframe phải load đúng pathname này.
 * Chrome không cho patch Location.pathname, nên không dùng /dtr/sortmachine/:id/... trong iframe.
 */
export const DTR_BARE_APP_ROUTES = [
  '/dashboard',
  '/online',
  '/s',
  '/share',
  '/tools',
  '/autotrain',
  '/newbottle',
  '/productionorder',
  '/admin',
];

const proxy = httpProxy.createProxyServer({
  xfwd: true,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: true,
  proxyTimeout: 60_000,
  timeout: 60_000,
});

/** Port phụ (camera MJPEG :1007, …) — không buffer body (stream vô hạn). */
const streamProxy = httpProxy.createProxyServer({
  xfwd: true,
  changeOrigin: true,
  ws: true,
  selfHandleResponse: false,
  proxyTimeout: 0,
  timeout: 0,
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
streamProxy.on('error', logProxyError);
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

export function isDtrBareAppPath(pathname = '/') {
  return DTR_BARE_APP_ROUTES.some(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );
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
 * Address bar: /dtr/sortmachine/:id/s
 * Layout: sidebar danh sách máy (trái) + iframe app máy (phải)
 * iframe: /s?dtr_embed=1
 */
export function buildFrameShell({ machineId, restPath, query = '' }) {
  const prefix = machinePrefix(machineId);
  const params = new URLSearchParams(
    query.startsWith('?') ? query.slice(1) : query,
  );
  params.set('dtr_embed', '1');
  const rest = restPath && restPath !== '/' ? restPath : '/s';
  const iframeSrc = `${rest.startsWith('/') ? rest : `/${rest}`}?${params.toString()}`;
  const safePrefix = JSON.stringify(prefix);
  const safeSrc = JSON.stringify(iframeSrc);
  const safeId = String(machineId).replace(/[<>&"]/g, '');
  const safeMachineId = JSON.stringify(String(machineId));
  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>DTR Sort Machine ${safeId}</title>
  <style>
    :root {
      --dtr-side: 240px;
      --dtr-bg: #0b1220;
      --dtr-panel: #111827;
      --dtr-line: #1f2a3d;
      --dtr-text: #e5eefc;
      --dtr-muted: #94a3b8;
      --dtr-accent: #3b82f6;
      --dtr-active: #1d4ed8;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; height: 100%; background: var(--dtr-bg); overflow: hidden; font-family: Segoe UI, system-ui, sans-serif; }
    .dtr-shell { display: flex; height: 100%; width: 100%; }
    .dtr-side {
      width: var(--dtr-side); flex: 0 0 var(--dtr-side);
      background: var(--dtr-panel); color: var(--dtr-text);
      border-right: 1px solid var(--dtr-line);
      display: flex; flex-direction: column; min-height: 0;
    }
    .dtr-side__head {
      padding: 0.85rem 0.9rem 0.7rem;
      border-bottom: 1px solid var(--dtr-line);
    }
    .dtr-side__eyebrow {
      margin: 0 0 0.2rem; font-size: 0.68rem; font-weight: 700;
      letter-spacing: 0.08em; text-transform: uppercase; color: var(--dtr-muted);
    }
    .dtr-side__title { margin: 0; font-size: 0.95rem; font-weight: 700; }
    .dtr-side__link {
      display: inline-block; margin-top: 0.55rem; font-size: 0.78rem;
      color: #93c5fd; text-decoration: none;
    }
    .dtr-side__link:hover { text-decoration: underline; }
    .dtr-mode-toggle {
      display: inline-flex; margin-top: 0.65rem; border-radius: 999px;
      overflow: hidden; border: 1px solid rgba(59,130,246,0.45);
      background: rgba(15, 23, 42, 0.55);
    }
    .dtr-mode-toggle__btn {
      appearance: none; border: 0; margin: 0; padding: 0.28rem 0.7rem;
      font-size: 0.68rem; font-weight: 800; letter-spacing: 0.04em;
      text-transform: uppercase; color: var(--dtr-muted);
      background: transparent; cursor: pointer;
    }
    .dtr-mode-toggle__btn + .dtr-mode-toggle__btn {
      border-left: 1px solid rgba(59,130,246,0.35);
    }
    .dtr-mode-toggle__btn.is-active {
      background: var(--dtr-accent); color: #fff;
    }
    .dtr-mode-toggle__btn:not(.is-active):hover {
      background: rgba(59,130,246,0.18); color: var(--dtr-text);
    }
    .dtr-tree {
      flex: 1; overflow: auto; padding: 0.55rem 0.45rem 0.85rem;
    }
    .dtr-tree__group {
      margin: 0 0.35rem 0.35rem; padding: 0.25rem 0.4rem;
      font-size: 0.7rem; font-weight: 700; color: var(--dtr-muted);
      text-transform: uppercase; letter-spacing: 0.05em;
    }
    .dtr-tree__item {
      display: block; width: 100%; text-align: left;
      border: 0; background: transparent; color: var(--dtr-text);
      border-radius: 8px; padding: 0.55rem 0.65rem; cursor: pointer;
      margin: 0 0 0.2rem;
    }
    .dtr-tree__item:hover { background: rgba(59,130,246,0.12); }
    .dtr-tree__item.is-active {
      background: rgba(37,99,235,0.28);
      box-shadow: inset 3px 0 0 var(--dtr-accent);
    }
    .dtr-tree__id { display: block; font-size: 0.78rem; font-weight: 700; }
    .dtr-tree__name {
      display: block; margin-top: 0.12rem; font-size: 0.72rem; color: var(--dtr-muted);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .dtr-tree__status {
      margin: 0.5rem 0.65rem; font-size: 0.75rem; color: var(--dtr-muted);
    }
    .dtr-main { flex: 1; min-width: 0; min-height: 0; background: var(--dtr-panel); }
    .dtr-main iframe { border: 0; width: 100%; height: 100%; display: block; background: var(--dtr-panel); }
    .dtr-side__close {
      display: none; position: absolute; top: 0.55rem; right: 0.55rem;
      width: 2rem; height: 2rem; border: 0; border-radius: 999px;
      background: rgba(148,163,184,0.16); color: var(--dtr-text);
      font-size: 1.15rem; line-height: 1; cursor: pointer;
    }
    .dtr-side__close:hover { background: rgba(148,163,184,0.28); }
    .dtr-side__backdrop {
      display: none; position: fixed; inset: 0; z-index: 1040;
      background: rgba(2, 6, 23, 0.48); border: 0; padding: 0; cursor: pointer;
    }
    .dtr-sidebar-pull {
      display: none; position: fixed; top: 50%; left: 0; z-index: 1045;
      flex-direction: column; align-items: center; justify-content: center; gap: 0.28rem;
      width: 1.7rem; height: 4.4rem; padding: 0; margin: 0;
      border: 1px solid rgba(59,130,246,0.55); border-left: none;
      border-radius: 0 0.7rem 0.7rem 0;
      background: linear-gradient(180deg, #3b82f6, #1d4ed8);
      color: #fff; box-shadow: 2px 0 12px rgba(29,78,216,0.35);
      transform: translate(-0.35rem, -50%);
      transition: transform 0.22s ease, box-shadow 0.22s ease, width 0.22s ease;
      cursor: pointer; -webkit-tap-highlight-color: transparent;
    }
    .dtr-sidebar-pull__grip {
      width: 0.22rem; height: 1.15rem; border-radius: 999px;
      background: rgba(255,255,255,0.78);
      box-shadow: 4px 0 0 rgba(255,255,255,0.35);
    }
    .dtr-sidebar-pull__icon { font-size: 0.85rem; line-height: 1; opacity: 0.95; }
    .dtr-sidebar-pull:active { transform: translate(0, -50%); filter: brightness(0.96); }
    @media (max-width: 991.98px) {
      .dtr-shell { display: block; }
      .dtr-side {
        position: fixed; top: 0; left: 0; bottom: 0; z-index: 1050;
        width: min(86vw, 300px); flex: none;
        transform: translateX(-105%);
        transition: transform 0.24s ease;
        box-shadow: 8px 0 28px rgba(2, 6, 23, 0.35);
      }
      .dtr-side.is-open { transform: translateX(0); }
      .dtr-side__head { position: relative; padding-right: 2.6rem; }
      .dtr-side__close { display: inline-flex; align-items: center; justify-content: center; }
      .dtr-side__backdrop.is-open { display: block; }
      .dtr-sidebar-pull { display: flex; }
      .dtr-main { width: 100%; height: 100%; }
      body.dtr-drawer-open { overflow: hidden; }
    }
    @media (min-width: 992px) and (max-width: 1100px) {
      :root { --dtr-side: 210px; }
    }
  </style>
</head>
<body>
  <div class="dtr-shell">
    <button type="button" class="dtr-sidebar-pull" id="dtr-sidebar-pull" aria-label="Mở danh sách máy" aria-controls="dtr-side" aria-expanded="false">
      <span class="dtr-sidebar-pull__grip" aria-hidden="true"></span>
      <span class="dtr-sidebar-pull__icon" aria-hidden="true">›</span>
    </button>
    <button type="button" class="dtr-side__backdrop" id="dtr-side-backdrop" aria-label="Đóng danh sách máy" hidden></button>
    <aside class="dtr-side" id="dtr-side" aria-label="Danh sách máy">
      <div class="dtr-side__head">
        <p class="dtr-side__eyebrow">DTR Portal</p>
        <h1 class="dtr-side__title">Sort machines</h1>
        <div class="dtr-mode-toggle" role="group" aria-label="Chế độ Online / Offline">
          <button type="button" class="dtr-mode-toggle__btn" id="dtr-mode-offline" title="Chế độ Offline">Offline</button>
          <button type="button" class="dtr-mode-toggle__btn is-active" id="dtr-mode-online" title="Chế độ Online" aria-pressed="true">Online</button>
        </div>
        <a class="dtr-side__link" href="/dtr/sortmachine">← Quản lý máy</a>
        <button type="button" class="dtr-side__close" id="dtr-side-close" aria-label="Đóng">×</button>
      </div>
      <div class="dtr-tree" id="dtr-tree">
        <p class="dtr-tree__status" id="dtr-tree-status">Đang tải máy…</p>
      </div>
    </aside>
    <main class="dtr-main">
      <iframe id="dtr-frame" title="DTR Sort Machine" src=${safeSrc} allow="fullscreen *; autoplay *"></iframe>
    </main>
  </div>
  <script>
  (function () {
    var prefix = ${safePrefix};
    var currentId = ${safeMachineId};
    var frame = document.getElementById('dtr-frame');
    var tree = document.getElementById('dtr-tree');
    var statusEl = document.getElementById('dtr-tree-status');
    var side = document.getElementById('dtr-side');
    var pullBtn = document.getElementById('dtr-sidebar-pull');
    var closeBtn = document.getElementById('dtr-side-close');
    var backdrop = document.getElementById('dtr-side-backdrop');
    var offlineBtn = document.getElementById('dtr-mode-offline');
    var syncing = false;
    var drawerOpen = false;

    if (offlineBtn) {
      offlineBtn.addEventListener('click', function () {
        if (!currentId) return;
        window.location.assign('/dtr/sortmachine/' + encodeURIComponent(currentId));
      });
    }

    function isMobileDrawer() {
      return window.matchMedia('(max-width: 991.98px)').matches;
    }

    function setDrawerOpen(open) {
      drawerOpen = !!open && isMobileDrawer();
      if (side) side.classList.toggle('is-open', drawerOpen);
      if (backdrop) {
        backdrop.classList.toggle('is-open', drawerOpen);
        backdrop.hidden = !drawerOpen;
      }
      document.body.classList.toggle('dtr-drawer-open', drawerOpen);
      if (pullBtn) {
        pullBtn.setAttribute('aria-expanded', drawerOpen ? 'true' : 'false');
        pullBtn.style.display = drawerOpen ? 'none' : '';
      }
    }

    function openDrawer() { setDrawerOpen(true); }
    function closeDrawer() { setDrawerOpen(false); }

    if (pullBtn) pullBtn.addEventListener('click', openDrawer);
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeDrawer();
    });
    window.addEventListener('resize', function () {
      if (!isMobileDrawer()) closeDrawer();
    });

    function cleanSearch(search) {
      return String(search || '')
        .replace(/([?&])dtr_embed=1(&|$)/, function (_, a, b) { return b === '&' ? a : ''; })
        .replace(/[?&]$/, '');
    }

    function pathFromFrame() {
      try {
        var loc = frame.contentWindow.location;
        if (loc.origin !== location.origin) return null;
        return (loc.pathname || '/') + cleanSearch(loc.search) + (loc.hash || '');
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

    function navigateFrame(parentUrl) {
      syncing = true;
      var rest = parentUrl || '/';
      if (rest.indexOf(prefix) === 0) rest = rest.slice(prefix.length) || '/';
      if (rest.charAt(0) !== '/') rest = '/' + rest;
      var join = rest.indexOf('?') >= 0 ? '&' : '?';
      if (rest.indexOf('dtr_embed=') < 0) rest = rest + join + 'dtr_embed=1';
      try { frame.contentWindow.location.href = rest; }
      catch (e) { frame.src = rest; }
      setTimeout(function () { syncing = false; }, 0);
    }

    function escapeHtml(s) {
      return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    function openMachine(id) {
      if (!id) return;
      if (id === currentId) {
        closeDrawer();
        return;
      }
      window.location.assign('/dtr/sortmachine/' + encodeURIComponent(id) + '/s');
    }

    function renderMachines(machines) {
      var list = Array.isArray(machines) ? machines.slice() : [];
      list.sort(function (a, b) {
        return String(a.machine_id || '').localeCompare(String(b.machine_id || ''));
      });
      if (!list.length) {
        tree.innerHTML = '<p class="dtr-tree__status">Chưa có máy nào.</p>';
        return;
      }
      var html = '<div class="dtr-tree__group">Máy</div>';
      list.forEach(function (m) {
        var id = String(m.machine_id || '');
        var name = String(m.name || id);
        var active = id === currentId ? ' is-active' : '';
        html += '<button type="button" class="dtr-tree__item' + active + '" data-id="' + escapeHtml(id) + '">'
          + '<span class="dtr-tree__id">' + escapeHtml(id) + '</span>'
          + '<span class="dtr-tree__name">' + escapeHtml(name) + '</span>'
          + '</button>';
      });
      tree.innerHTML = html;
      tree.querySelectorAll('.dtr-tree__item').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openMachine(btn.getAttribute('data-id'));
        });
      });
    }

    function loadMachines() {
      var token = '';
      try { token = localStorage.getItem('token') || ''; } catch (e) {}
      var headers = { Accept: 'application/json' };
      if (token) headers.Authorization = 'Bearer ' + token;
      fetch('/api/portal/dtr/sort-machines', { headers: headers, credentials: 'same-origin' })
        .then(function (res) {
          if (!res.ok) throw new Error('HTTP ' + res.status);
          return res.json();
        })
        .then(function (data) {
          renderMachines(data && data.machines ? data.machines : []);
        })
        .catch(function () {
          if (statusEl) statusEl.textContent = 'Không tải được danh sách máy.';
          else tree.innerHTML = '<p class="dtr-tree__status">Không tải được danh sách máy.</p>';
        });
    }

    frame.addEventListener('load', syncParentFromFrame);
    setInterval(syncParentFromFrame, 300);

    window.addEventListener('popstate', function () {
      navigateFrame(location.pathname + location.search + location.hash);
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

    loadMachines();
  })();
  </script>
</body>
</html>`;
}

/**
 * Shim trong iframe pathname trần (/dashboard):
 * - port khác → /dtr-p/:port
 * - asset absolute → /dtr/sortmachine/:id/... (tránh đụng /assets Plenma)
 * - KHÔNG đổi pushState path (giữ /online cho RR)
 * - chặn breakout + báo parent
 */
export function buildClientShim(prefix) {
  const p = JSON.stringify(prefix || '');
  return `<script data-dtr-shim="1">(function(){
var PREFIX=${p};
function rewriteAssetOrPort(url){
  try{
    var raw=String(url==null?"":url);
    if(!raw||raw.charAt(0)==="#") return url;
    if(raw.indexOf("blob:")===0||raw.indexOf("data:")===0||raw.indexOf("mailto:")===0||raw.indexOf("javascript:")===0) return url;
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
    var isAsset=path.indexOf("/assets/")===0||/\\.(js|mjs|css|png|jpe?g|gif|svg|webp|ico|woff2?|ttf|map|json|wasm)$/i.test(path);
    if(isAsset && path.indexOf(PREFIX)!==0 && path.indexOf("/dtr-p/")!==0){
      path=PREFIX+path;
      if(u.protocol==="ws:"||u.protocol==="wss:"){
        return (location.protocol==="https:"?"wss://":"ws://")+location.host+path+(u.search||"")+(u.hash||"");
      }
      if(/^https?:/i.test(raw)||raw.indexOf("//")===0) return location.origin+path+(u.search||"")+(u.hash||"");
      return path+(u.search||"")+(u.hash||"");
    }
    return url;
  }catch(e){return url;}
}
var _fetch=window.fetch;
window.fetch=function(input, init){
  if(typeof input==="string") input=rewriteAssetOrPort(input);
  else if(input&&typeof input.url==="string") input=new Request(rewriteAssetOrPort(input.url), input);
  return _fetch.call(this, input, init);
};
var XO=XMLHttpRequest.prototype.open;
XMLHttpRequest.prototype.open=function(){
  var args=Array.prototype.slice.call(arguments);
  if(typeof args[1]==="string") args[1]=rewriteAssetOrPort(args[1]);
  return XO.apply(this, args);
};
var OrigWS=window.WebSocket;
function DtrWS(url, protocols){
  var next=rewriteAssetOrPort(String(url||""));
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
    set:function(v){ return desc.set.call(this, rewriteAssetOrPort(v)); }
  });
}
hookAttr(HTMLImageElement&&HTMLImageElement.prototype,"src");
hookAttr(HTMLScriptElement&&HTMLScriptElement.prototype,"src");
hookAttr(HTMLSourceElement&&HTMLSourceElement.prototype,"src");
hookAttr(HTMLMediaElement&&HTMLMediaElement.prototype,"src");
hookAttr(HTMLLinkElement&&HTMLLinkElement.prototype,"href");
var SA=Element.prototype.setAttribute;
Element.prototype.setAttribute=function(name, value){
  var n=String(name||"").toLowerCase();
  if(n==="src"||n==="href"||n==="poster"||n==="data") value=rewriteAssetOrPort(value);
  if(n==="target" && (value==="_top"||value==="_parent")) value="_self";
  return SA.call(this, name, value);
};
document.addEventListener("click",function(e){
  var a=e.target&&e.target.closest?e.target.closest("a[href]"):null;
  if(!a) return;
  if(a.target==="_top"||a.target==="_parent") a.target="_self";
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
  if (!prefix) return content;
  let html = content;
  if (/<head[\s>]/i.test(html) && !/data-dtr-shim=/i.test(html)) {
    html = html.replace(/<head([^>]*)>/i, `<head$1>${buildClientShim(prefix)}`);
  }
  // Asset tuyệt đối → dưới prefix (Plenma giữ /assets của mình)
  html = html.replace(
    /\b(src|href)=(["'])\/(?!\/|dtr\/sortmachine|dtr-p\/|api\/|socket\.io)/gi,
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
  const contentType = String(proxyRes.headers['content-type'] || '');

  // JS/CSS/MJPEG/… — pipe thẳng (camera stream không bao giờ end)
  if (!shouldRewrite(contentType)) {
    const headers = { ...proxyRes.headers };
    delete headers['x-frame-options'];
    res.writeHead(proxyRes.statusCode || 200, headers);
    proxyRes.pipe(res);
    return;
  }

  const chunks = [];
  proxyRes.on('data', (chunk) => chunks.push(chunk));
  proxyRes.on('end', async () => {
    try {
      const raw = Buffer.concat(chunks);
      const encoding = String(proxyRes.headers['content-encoding'] || '');
      let body = raw;

      if (raw.length > 0) {
        const decoded = await decompress(raw, encoding);
        const rewritten = rewriteHtml(decoded.toString('utf8'), req.dtrPrefix || '');
        body = Buffer.from(rewritten, 'utf8');
        const headers = { ...proxyRes.headers };
        delete headers['content-encoding'];
        delete headers['content-length'];
        delete headers['transfer-encoding'];
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

function proxyWeb(req, res, target, prefix, { stream = false } = {}) {
  req.dtrPrefix = prefix || '';
  if (stream) {
    streamProxy.web(req, res, {
      target,
      ignorePath: false,
    });
    return;
  }
  proxy.web(req, res, {
    target,
    ignorePath: false,
    selfHandleResponse: true,
  });
}

function redirectToMachinePath(res, machineId, pathname, query = '') {
  const rest = !pathname || pathname === '/' ? '/s' : pathname;
  const params = new URLSearchParams(
    query.startsWith('?') ? query.slice(1) : query,
  );
  params.delete('dtr_embed');
  const q = params.toString();
  res.redirect(302, `${machinePrefix(machineId)}${rest}${q ? `?${q}` : ''}`);
}

/**
 * 1) /dtr/sortmachine → clear cookie
 * 2) /dtr/sortmachine/:id/... → shell (HTML) hoặc proxy asset/embed dưới prefix
 * 3) /dtr-p/:port → port phụ
 * 4) /dashboard|/online (nginx) → embed proxy hoặc 302 về prefix
 * 5) /socket.io|/stats (nginx) → proxy nếu có cookie
 * KHÔNG bắt / hay /assets Plenma trừ khi cookie + nginx gửi tới
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

    if (isDocumentNavigation(req) && !isEmbedRequest(req)) {
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
                restPath: entry.rest || '/s',
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
        // Camera MJPEG / PLC HTTP — stream, không buffer
        proxyWeb(req, res, resolved.target, machinePrefix(machineId), { stream: true });
      })
      .catch((err) => {
        console.error('[dtr-proxy] port', err.message);
        res.status(500).type('text').send('DTR port proxy error');
      });
    return;
  }

  // Bare app routes từ Nginx: /dashboard, /online
  if (isDtrBareAppPath(pathname)) {
    if (!machineId) {
      res.status(401).type('text').send('Thiếu cookie máy DTR — mở lại từ /dtr/sortmachine/<id>/');
      return;
    }
    if (isDocumentNavigation(req) && !isEmbedRequest(req)) {
      redirectToMachinePath(res, machineId, pathname, query);
      return;
    }
    const params = new URLSearchParams(query.startsWith('?') ? query.slice(1) : '');
    params.delete('dtr_embed');
    const cleanQ = params.toString();
    req.url = `${pathname}${cleanQ ? `?${cleanQ}` : ''}`;
    resolveMachineTarget(machineId, pathname)
      .then((resolved) => {
        if (resolved.errorStatus) {
          res.status(resolved.errorStatus).type('text').send(resolved.error);
          return;
        }
        proxyWeb(req, res, resolved.target, machinePrefix(machineId));
      })
      .catch((err) => {
        console.error('[dtr-proxy] bare', err.message);
        res.status(500).type('text').send('DTR bare proxy error');
      });
    return;
  }

  // Chỉ socket.io/stats trần (Nginx) — KHÔNG bắt /api (Plenma)
  if (
    machineId &&
    (pathname.startsWith('/socket.io') || pathname.startsWith('/stats'))
  ) {
    resolveMachineTarget(machineId, pathname)
      .then((resolved) => {
        if (resolved.errorStatus) {
          res.status(resolved.errorStatus).type('text').send(resolved.error);
          return;
        }
        proxyWeb(req, res, resolved.target, machinePrefix(machineId));
      })
      .catch((err) => {
        console.error('[dtr-proxy] api', err.message);
        res.status(500).type('text').send('DTR api proxy error');
      });
    return;
  }

  return next();
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
        const resolved = await resolveMachineTarget(entry.machineId, entry.rest);
        if (resolved.errorStatus) {
          socket.destroy();
          return;
        }
        req.url = `${entry.rest}${url.search}`;
        wsProxy.ws(req, socket, head, { target: resolved.target });
        return;
      }

      if (!machineId) return;
      if (
        isDtrBareAppPath(url.pathname) ||
        url.pathname.startsWith('/socket.io') ||
        url.pathname.startsWith('/stats')
      ) {
        const resolved = await resolveMachineTarget(machineId, url.pathname);
        if (resolved.errorStatus) {
          socket.destroy();
          return;
        }
        wsProxy.ws(req, socket, head, { target: resolved.target });
      }
    } catch (err) {
      console.error('[dtr-proxy] ws', err.message);
      socket.destroy();
    }
  });
}
