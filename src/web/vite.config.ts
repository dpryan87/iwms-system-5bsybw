// vite.config.ts
// @vitejs/plugin-react v4.0.3
// vite v4.4.4
// path from node:path

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  // Base configuration for the application
  base: '/',

  // Configure plugins
  plugins: [
    react({
      // Enable Fast Refresh for rapid development
      fastRefresh: true,
      // Use automatic JSX runtime
      jsxRuntime: 'automatic',
      // Babel configuration for optimized builds
      babel: {
        plugins: [
          ['@babel/plugin-transform-runtime', {
            useESModules: true
          }]
        ]
      }
    })
  ],

  // Module resolution configuration
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@utils': path.resolve(__dirname, './src/utils')
    }
  },

  // Development server configuration
  server: {
    port: 3000,
    strictPort: true,
    host: true,
    // API proxy configuration for development
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, '')
      },
      '/ws': {
        target: 'ws://localhost:8080',
        ws: true,
        changeOrigin: true
      }
    },
    // Hot Module Replacement configuration
    hmr: {
      overlay: true
    }
  },

  // Production build configuration
  build: {
    // Browser compatibility targets based on requirements
    target: [
      'es2020',
      'chrome90',
      'firefox88', 
      'safari14',
      'edge91'
    ],
    // Output directory configuration
    outDir: 'dist',
    assetsDir: 'assets',
    // Source map generation for debugging
    sourcemap: true,
    // Minification configuration
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      },
      format: {
        comments: false
      }
    },
    // Bundle splitting configuration
    rollupOptions: {
      output: {
        manualChunks: {
          // Split vendor chunks for optimal caching
          vendor: ['react', 'react-dom', '@mui/material'],
          redux: ['@reduxjs/toolkit', 'react-redux'],
          visualization: ['d3'],
          utils: ['date-fns', 'lodash']
        }
      }
    },
    // Performance optimization settings
    chunkSizeWarningLimit: 1000,
    cssCodeSplit: true,
    reportCompressedSize: true
  },

  // Preview server configuration
  preview: {
    port: 3000,
    strictPort: true,
    host: true
  },

  // Test environment configuration
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/setupTests.ts'],
    coverage: {
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'src/setupTests.ts'
      ]
    }
  },

  // Global defines for the application
  define: {
    __APP_VERSION__: 'JSON.stringify(process.env.npm_package_version)'
  },

  // Optimization settings
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      '@mui/material',
      '@reduxjs/toolkit',
      'react-redux',
      'd3'
    ],
    exclude: []
  },

  // CSS configuration
  css: {
    modules: {
      localsConvention: 'camelCase'
    },
    preprocessorOptions: {
      scss: {
        additionalData: '@import "@/styles/variables.scss";'
      }
    }
  }
});