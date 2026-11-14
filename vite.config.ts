import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
export default defineConfig({ plugins: [react(), tailwindcss(), VitePWA({
  registerType: 'prompt', injectRegister: 'script', includeAssets: ['favicon.svg','icons/*.png'],
  manifest: { id:'/', name:'Checador · Registro de jornada', short_name:'Checador', description:'Entradas, salidas y comprobantes de su jornada.', lang:'es-MX',
    start_url:'/',scope:'/',display:'standalone',background_color:'#F2F5FA',theme_color:'#17324D',
    icons:[{src:'/icons/icon-192.png',sizes:'192x192',type:'image/png'},{src:'/icons/icon-512.png',sizes:'512x512',type:'image/png'},{src:'/icons/maskable-512.png',sizes:'512x512',type:'image/png',purpose:'maskable'}],
    shortcuts:[{name:'Quiosco',short_name:'Quiosco',url:'/quiosco',icons:[{src:'/icons/icon-192.png',sizes:'192x192'}]}] },
  workbox:{ globPatterns:['**/*.{js,css,html,png,svg}'],runtimeCaching:[],navigateFallback:'/index.html',cleanupOutdatedCaches:true,
    navigateFallbackDenylist:[/^\/rest\//,/^\/auth\//,/^\/functions\//],clientsClaim:true,skipWaiting:false }
})], build:{chunkSizeWarningLimit:650} });
