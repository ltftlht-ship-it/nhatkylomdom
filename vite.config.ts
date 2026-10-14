import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
      proxy: {
        '/api/forexfactory': {
          target: 'https://nfs.faireconomy.media',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/forexfactory/, ''),
        },
        '/api/tradingview-calendar': {
          target: 'https://economic-calendar.tradingview.com',
          changeOrigin: true,
          headers: {
            'Origin': 'https://www.tradingview.com',
            'Referer': 'https://www.tradingview.com/',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          },
          rewrite: (p) => p.replace(/^\/api\/tradingview-calendar/, ''),
        },
        '/api/yahoo': {
          target: 'https://query1.finance.yahoo.com',
          changeOrigin: true,
          rewrite: (p) => p.replace(/^\/api\/yahoo/, ''),
        },
      },
    },
  };
});
