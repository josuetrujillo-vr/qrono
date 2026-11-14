import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir:'./tests/browser',fullyParallel:false,workers:1,timeout:60000,expect:{timeout:15000},
  use:{baseURL:'http://127.0.0.1:4180',headless:true,channel:'msedge',screenshot:'only-on-failure'},
  webServer:{command:'npm run dev -- --port 4180 --strictPort',url:'http://127.0.0.1:4180',reuseExistingServer:false,
    env:{VITE_SUPABASE_URL:'http://127.0.0.1:54321',VITE_SUPABASE_ANON_KEY:'public-test-key',VITE_APP_URL:'http://127.0.0.1:4180'}}
});
