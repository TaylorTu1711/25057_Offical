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
      // Deep-link máy DTR (vd. /dtr/sortmachine/25231/s) → Express; /dtr/sortmachine/:id (SPA) giữ Vite
      '^/dtr/sortmachine/[^/]+/.+': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      '/dtr-p': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
      },
      // Cookie dtr_machine: chỉ proxy path máy DTR (iframe), giữ SPA Plenma trên Vite
      '/': {
        target: backendTarget,
        changeOrigin: true,
        ws: true,
        bypass(req) {
          const u = req.url || ''
          const path = u.split('?')[0]

          // Không cookie → luôn Vite
          if (!hasDtrCookie(req)) return req.url

          // Vite / SPA Plenma — không đẩy sang Express
          if (
            u.startsWith('/api/')
            || u.startsWith('/@vite')
            || u.startsWith('/@react-refresh')
            || u.startsWith('/node_modules')
            || u.startsWith('/src/')
            || u.startsWith('/assets/')
            || path === '/'
            || path === '/index.html'
            || path === '/favicon.ico'
            || path.startsWith('/login')
            || path.startsWith('/register')
            || path.startsWith('/machines')
            || path.startsWith('/mida')
            || path === '/dtr/sortmachine'
            || path === '/dtr/sortmachine/'
            // SPA chi tiết: /dtr/sortmachine/:id (không có path con)
            || /^\/dtr\/sortmachine\/[^/]+\/?$/.test(path)
            || path.startsWith('/.well-known')
          ) {
            return req.url
          }

          // Còn lại (vd. /s, /dashboard khi đang xem máy DTR) → Express proxy
          return null
        },
      },
    },
  },
})
