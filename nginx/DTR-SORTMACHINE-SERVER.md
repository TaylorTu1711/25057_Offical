# Cấu hình server — DTR Sort Machine (không cần Tailscale trên thiết bị user)

## Kiến trúc đã chọn (tối ưu)

```text
User mở https://scada.plenmaiot.com/dtr/sortmachine/25231/online
  → Express set cookie dtr_machine=25231
  → 302 redirect → https://scada.plenmaiot.com/online
  → Nginx thấy cookie → Express → Tailscale :5173/online
```

React Router thấy pathname `/online` giống `http://100.x.x.x:5173/online` → trang hiện đúng.

- Thêm máy trên UI = ghi DB (`machine_id`, `tailscale_ip`, `port`, `api_port`).
- **Không** sửa Nginx mỗi lần thêm máy.
- Client **không** cài Tailscale.
- Cần cập nhật Nginx theo `scada-production.conf.example` (block `@dtr_cookie_proxy`).

---

## A. Trên máy sort (nội bộ)

1. Cài Tailscale, cùng tailnet với server `scada`.
2. Chạy web app listen `0.0.0.0` (port trong portal, thường `5173`).
3. Mở firewall TCP port đó cho mạng Tailscale.
4. Ghi IP Tailscale (vd. `100.70.140.122`).

Kiểm tra **từ server scada**:

```bash
tailscale status
ping -c 2 100.70.140.122
curl -sI --max-time 5 http://100.70.140.122:5173/
```

---

## B. Trên server `scada.plenmaiot.com`

1. Cài Tailscale, login cùng tailnet.
2. Backend Express chạy `:3000` (có gateway DTR trong code).
3. Frontend build (`frontend/dist`) + Nginx SSL như hiện tại.
4. Deploy code mới (có `dtrSortMachineProxy`).
5. Seed user (nếu chưa):

```bash
npm run seed:dtr-sortmachine
```

6. Cập nhật Nginx theo `nginx/scada-production.conf.example`:
   - Exact `/dtr/sortmachine` → SPA
   - Regex `/dtr/sortmachine/<id>` → `proxy_pass http://127.0.0.1:3000`
7. Đảm bảo trong `http { }` có:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    ''      close;
}
```

8. Reload Nginx:

```bash
sudo nginx -t && sudo systemctl reload nginx
```

---

## C. Kiểm tra end-to-end

```bash
# Từ server
curl -sI http://127.0.0.1:3000/dtr/sortmachine/25231/

# Từ Internet / điện thoại (không Tailscale)
# 1) Login https://scada.plenmaiot.com/login
#    user: dtrsortmachine@plenma.com
# 2) Vào /dtr/sortmachine → Thêm máy (id + IP Tailscale + port)
# 3) Bấm Mở → URL vẫn scada.plenmaiot.com/dtr/sortmachine/<id>/
# 4) DevTools Network: không thấy request tới 100.x.x.x
```

---

## D. Lỗi thường gặp

| Hiện tượng | Nguyên nhân | Cách xử lý |
|---|---|---|
| 502 | Server không tới được IP:port Tailscale | `curl` từ server; bật máy/app/firewall |
| 404 máy | Sai `machine_id` hoặc chưa thêm trên UI | Kiểm tra list `/dtr/sortmachine` |
| Vẫn nhảy sang `100.x` | Frontend cũ | Deploy bản mới (mở bằng path domain) |
| Trang trắng + `Manifest: Line 1 Syntax error` | App remote dùng `/assets`, `/manifest` tuyệt đối → Nginx trả HTML SCADA | Gateway rewrite path (code mới); restart backend; hard refresh |
| Mixed Content `http://scada...:1411` | App gọi API HTTP port khác từ trang HTTPS | Đặt `api_port=1411` trên máy; gateway shim đổi sang HTTPS path; hard refresh |
| Mixed Content `ws://scada...:1411/socket.io` | Socket.IO dùng WS không mã hóa | Shim đổi sang `wss://.../dtr/sortmachine/<id>/socket.io`; proxy `/socket.io` → api_port |
| URL nhảy `/dashboard` (mất prefix) | React Router absolute path | Shim giữ prefix; hard refresh bản backend mới |
| CSS/JS 404 trên máy remote | Path chưa qua `/dtr/sortmachine/<id>/` | Pull code proxy rewrite; hoặc build remote với `base: './'` |
| SPA nuốt `/dtr/sortmachine/id` | Nginx thiếu block regex trước `location /` | Thêm block như file example |

### Máy sort (khuyến nghị thêm)

Production build Vite trên máy nội bộ nên dùng base tương đối để chắc chắn:

```js
// vite.config.js trên máy sort
export default defineConfig({
  base: './',
  // ...
})
```

Rồi `npm run build` và serve `dist` (hoặc `vite preview --host`).

---

## E. Bảo mật

- Không mở port 5173/3000 máy sort ra Internet.
- Chỉ server ↔ máy sort qua Tailscale.
- SSL terminate tại Nginx domain.
- Portal quản lý vẫn yêu cầu đăng nhập.
