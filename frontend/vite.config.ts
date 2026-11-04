import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // 使用自签名证书启用 HTTPS，使麦克风录音在非 localhost 环境下可用
    basicSsl(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    // 监听所有网络接口，便于通过 SSH 隧道对外访问
    host: '0.0.0.0',
    https: true,
    proxy: {
      // 开发环境把 /api 代理到后端，流式 SSE 也走此转发
      '/api': {
        target: 'http://localhost:9000',
        changeOrigin: true,
        // 后端为明文 HTTP，代理目标不用 HTTPS
        secure: false,
      },
    },
  },
})
