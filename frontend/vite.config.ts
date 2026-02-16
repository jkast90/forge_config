import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { execSync } from 'child_process'

function getGitCommit(): string {
  try {
    return execSync('git rev-parse --short HEAD', { encoding: 'utf-8', cwd: path.resolve(__dirname, '..') }).trim()
  } catch {
    return 'live build'
  }
}

export default defineConfig({
  plugins: [react()],
  define: {
    __COMMIT_HASH__: JSON.stringify(getGitCommit()),
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, '../shared/core'),
      // Ensure shared/ code resolves packages from frontend/node_modules
      '@reduxjs/toolkit': path.resolve(__dirname, 'node_modules/@reduxjs/toolkit'),
      'react-redux': path.resolve(__dirname, 'node_modules/react-redux'),
    },
    dedupe: ['react', 'react-dom', 'react-redux', '@reduxjs/toolkit'],
  },
  server: {
    host: '0.0.0.0', // Listen on all interfaces in container
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      },
      '/ws': {
        target: process.env.VITE_API_URL || 'http://localhost:8080',
        changeOrigin: true,
        ws: true,
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
