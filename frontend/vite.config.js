import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const backendTarget = process.env.VITE_DEV_BACKEND_URL || 'http://localhost:3000'

function hasDtrCookie(req) {
  const cookie = req.headers.cookie || ''
  return /(?:^|;\s*)dtr_machine=/.test(cookie)
}

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    watch: {
      usePolling: true
    },
    proxy: {
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
      // Entry DTR: /dtr/sortmachine/:id → Express (set cookie + redirect)
      '^/dtr/sortmachine/[^/]+': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      // Khi đã có cookie dtr_machine: mọi path còn lại (trừ HMR Vite) → Express → Tailscale
      '/': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
        bypass(req) {
          if (!hasDtrCookie(req)) return req.url
          const u = req.url || ''
          if (u.startsWith('/api/')) return req.url
          if (u.startsWith('/@vite') || u.startsWith('/@react-refresh')) return req.url
          if (u.startsWith('/node_modules/.vite')) return req.url
          // Plenma source khi đang dev mà không xem máy DTR — đã return ở trên nếu không cookie
          if (u.startsWith('/src/') && !hasDtrCookie(req)) return req.url
          return null
        },
      },
    },
  },
})
