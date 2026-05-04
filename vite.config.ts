import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'icons/*.png'],
      manifest: {
        name: '당구 트레이너',
        short_name: 'Billiards',
        description: '한국식 4구·3쿠션 학습 도구',
        lang: 'ko',
        display: 'fullscreen',
        orientation: 'any',
        background_color: '#000034',
        theme_color: '#000034',
        start_url: '.',
        scope: '.',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
      },
      devOptions: {
        enabled: false, // 개발 중 SW 비활성 (필요 시 true로)
      },
    }),
  ],
  base: './', // GitHub Pages 등 서브 경로 배포 호환
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    host: true, // LAN의 모바일에서 테스트
  },
});
