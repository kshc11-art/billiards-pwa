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
  // GitHub Pages 배포 시 저장소 이름이 base path가 됨.
  // GitHub Actions 환경 변수 GITHUB_REPOSITORY로 자동 추출.
  // 로컬 빌드 시는 './' 사용.
  base: process.env.GITHUB_REPOSITORY
    ? `/${process.env.GITHUB_REPOSITORY.split('/')[1]}/`
    : './',
  build: {
    target: 'es2022',
    sourcemap: true,
  },
  server: {
    host: true, // LAN의 모바일에서 테스트
  },
});
