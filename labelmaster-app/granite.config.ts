import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  appName: 'can-i-eat-this',
  brand: {
    displayName: '이거먹어도돼?',
    primaryColor: '#1F8A5B',
    // 콘솔에 등록한 아이콘 URL
    icon: 'https://static.toss.im/appsintoss/7011/2d00e2a7-b045-4cf6-995a-94092eda8236.png',
  },
  permissions: [{ name: 'photos', access: 'read' }],
  web: {
    // 샌드박스가 접속할 개발 서버 주소. 네트워크가 바뀌면 host를 본인 LAN IP로 바꿔주세요.
    host: '192.168.35.40',
    port: 5173,
    commands: {
      dev: 'vite --host',
      build: 'vite build',
    },
  },
  outdir: 'dist',
});
