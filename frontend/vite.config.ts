import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@shared': path.resolve(__dirname, '../shared')
    },
    extensions: ['.ts', '.js', '.vue', '.json']
  },
  server: {
    port: 5173,
    fs: {
      allow: ['..']
    },
    proxy: {
      '/socket.io': {
        target: 'http://localhost:3001',
        ws: true,
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: []
    }
  }
})
