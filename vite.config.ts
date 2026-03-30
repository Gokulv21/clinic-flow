import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/prescripto/",
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    // mode === 'development' &&
    // componentTagger(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'prescriptionLogo.png'],
      manifest: {
        name: 'PreScripto',
        short_name: 'PreScripto',
        description: 'Advanced Clinic Management & Prescription System',
        theme_color: '#0284c7',
        icons: [
          {
            src: 'prescriptionLogo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'prescriptionLogo.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
