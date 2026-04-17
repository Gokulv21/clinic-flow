// vite.config.ts
import { defineConfig } from "file:///F:/My%20projects%20(leisure)/My%20portfolio/clinic-flow/node_modules/vite/dist/node/index.js";
import react from "file:///F:/My%20projects%20(leisure)/My%20portfolio/clinic-flow/node_modules/@vitejs/plugin-react-swc/index.js";
import path from "path";
var __vite_injected_original_dirname = "F:\\My projects (leisure)\\My portfolio\\clinic-flow";
var vite_config_default = defineConfig(({ mode }) => ({
  base: "/prescripto/",
  server: {
    host: "::",
    port: 8080
  },
  plugins: [
    react()
    // mode === 'development' &&
    // componentTagger(),
    // VitePWA({
    //   registerType: 'autoUpdate',
    //   includeAssets: ['favicon.ico', 'prescriptionLogo.png'],
    //   workbox: {
    //     maximumFileSizeToCacheInBytes: 5000000, // Now 5MB to handle larger assets
    //     globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg,webmanifest}']
    //   },
    //   manifest: {
    //     name: 'PreScripto',
    //     short_name: 'PreScripto',
    //     description: 'Advanced Clinic Management & Prescription System',
    //     theme_color: '#0284c7',
    //     icons: [
    //       {
    //         src: 'prescriptionLogo.png',
    //         sizes: '192x192',
    //         type: 'image/png'
    //       },
    //       {
    //         src: 'prescriptionLogo.png',
    //         sizes: '512x512',
    //         type: 'image/png'
    //       }
    //     ]
    //   }
    // })
  ].filter(Boolean),
  build: {
    chunkSizeWarningLimit: 1e3,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["framer-motion", "lucide-react", "clsx", "tailwind-merge"],
          "vendor-supabase": ["@supabase/supabase-js"],
          "vendor-utils": ["date-fns", "zod", "sonner"]
        }
      }
    }
  },
  resolve: {
    alias: {
      "@": path.resolve(__vite_injected_original_dirname, "./src")
    }
  }
}));
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJGOlxcXFxNeSBwcm9qZWN0cyAobGVpc3VyZSlcXFxcTXkgcG9ydGZvbGlvXFxcXGNsaW5pYy1mbG93XCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJGOlxcXFxNeSBwcm9qZWN0cyAobGVpc3VyZSlcXFxcTXkgcG9ydGZvbGlvXFxcXGNsaW5pYy1mbG93XFxcXHZpdGUuY29uZmlnLnRzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9GOi9NeSUyMHByb2plY3RzJTIwKGxlaXN1cmUpL015JTIwcG9ydGZvbGlvL2NsaW5pYy1mbG93L3ZpdGUuY29uZmlnLnRzXCI7aW1wb3J0IHsgZGVmaW5lQ29uZmlnIH0gZnJvbSBcInZpdGVcIjtcclxuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdC1zd2NcIjtcclxuaW1wb3J0IHBhdGggZnJvbSBcInBhdGhcIjtcclxuaW1wb3J0IHsgVml0ZVBXQSB9IGZyb20gJ3ZpdGUtcGx1Z2luLXB3YSc7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoKHsgbW9kZSB9KSA9PiAoe1xyXG4gIGJhc2U6IFwiL3ByZXNjcmlwdG8vXCIsXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjo6XCIsXHJcbiAgICBwb3J0OiA4MDgwLFxyXG4gIH0sXHJcbiAgcGx1Z2luczogW1xyXG4gICAgcmVhY3QoKSxcclxuICAgIC8vIG1vZGUgPT09ICdkZXZlbG9wbWVudCcgJiZcclxuICAgIC8vIGNvbXBvbmVudFRhZ2dlcigpLFxyXG4gICAgLy8gVml0ZVBXQSh7XHJcbiAgICAvLyAgIHJlZ2lzdGVyVHlwZTogJ2F1dG9VcGRhdGUnLFxyXG4gICAgLy8gICBpbmNsdWRlQXNzZXRzOiBbJ2Zhdmljb24uaWNvJywgJ3ByZXNjcmlwdGlvbkxvZ28ucG5nJ10sXHJcbiAgICAvLyAgIHdvcmtib3g6IHtcclxuICAgIC8vICAgICBtYXhpbXVtRmlsZVNpemVUb0NhY2hlSW5CeXRlczogNTAwMDAwMCwgLy8gTm93IDVNQiB0byBoYW5kbGUgbGFyZ2VyIGFzc2V0c1xyXG4gICAgLy8gICAgIGdsb2JQYXR0ZXJuczogWycqKi8qLntqcyxjc3MsaHRtbCxpY28scG5nLHN2ZyxqcGcsanBlZyx3ZWJtYW5pZmVzdH0nXVxyXG4gICAgLy8gICB9LFxyXG4gICAgLy8gICBtYW5pZmVzdDoge1xyXG4gICAgLy8gICAgIG5hbWU6ICdQcmVTY3JpcHRvJyxcclxuICAgIC8vICAgICBzaG9ydF9uYW1lOiAnUHJlU2NyaXB0bycsXHJcbiAgICAvLyAgICAgZGVzY3JpcHRpb246ICdBZHZhbmNlZCBDbGluaWMgTWFuYWdlbWVudCAmIFByZXNjcmlwdGlvbiBTeXN0ZW0nLFxyXG4gICAgLy8gICAgIHRoZW1lX2NvbG9yOiAnIzAyODRjNycsXHJcbiAgICAvLyAgICAgaWNvbnM6IFtcclxuICAgIC8vICAgICAgIHtcclxuICAgIC8vICAgICAgICAgc3JjOiAncHJlc2NyaXB0aW9uTG9nby5wbmcnLFxyXG4gICAgLy8gICAgICAgICBzaXplczogJzE5MngxOTInLFxyXG4gICAgLy8gICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xyXG4gICAgLy8gICAgICAgfSxcclxuICAgIC8vICAgICAgIHtcclxuICAgIC8vICAgICAgICAgc3JjOiAncHJlc2NyaXB0aW9uTG9nby5wbmcnLFxyXG4gICAgLy8gICAgICAgICBzaXplczogJzUxMng1MTInLFxyXG4gICAgLy8gICAgICAgICB0eXBlOiAnaW1hZ2UvcG5nJ1xyXG4gICAgLy8gICAgICAgfVxyXG4gICAgLy8gICAgIF1cclxuICAgIC8vICAgfVxyXG4gICAgLy8gfSlcclxuXHJcbiAgXS5maWx0ZXIoQm9vbGVhbiksXHJcbiAgYnVpbGQ6IHtcclxuICAgIGNodW5rU2l6ZVdhcm5pbmdMaW1pdDogMTAwMCxcclxuICAgIHJvbGx1cE9wdGlvbnM6IHtcclxuICAgICAgb3V0cHV0OiB7XHJcbiAgICAgICAgbWFudWFsQ2h1bmtzOiB7XHJcbiAgICAgICAgICAndmVuZG9yLXJlYWN0JzogWydyZWFjdCcsICdyZWFjdC1kb20nLCAncmVhY3Qtcm91dGVyLWRvbSddLFxyXG4gICAgICAgICAgJ3ZlbmRvci11aSc6IFsnZnJhbWVyLW1vdGlvbicsICdsdWNpZGUtcmVhY3QnLCAnY2xzeCcsICd0YWlsd2luZC1tZXJnZSddLFxyXG4gICAgICAgICAgJ3ZlbmRvci1zdXBhYmFzZSc6IFsnQHN1cGFiYXNlL3N1cGFiYXNlLWpzJ10sXHJcbiAgICAgICAgICAndmVuZG9yLXV0aWxzJzogWydkYXRlLWZucycsICd6b2QnLCAnc29ubmVyJ11cclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH1cclxuICB9LFxyXG4gIHJlc29sdmU6IHtcclxuICAgIGFsaWFzOiB7XHJcbiAgICAgIFwiQFwiOiBwYXRoLnJlc29sdmUoX19kaXJuYW1lLCBcIi4vc3JjXCIpLFxyXG4gICAgfSxcclxuICB9LFxyXG59KSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBbVYsU0FBUyxvQkFBb0I7QUFDaFgsT0FBTyxXQUFXO0FBQ2xCLE9BQU8sVUFBVTtBQUZqQixJQUFNLG1DQUFtQztBQU16QyxJQUFPLHNCQUFRLGFBQWEsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUFBLEVBQ3pDLE1BQU07QUFBQSxFQUNOLFFBQVE7QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxTQUFTO0FBQUEsSUFDUCxNQUFNO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQThCUixFQUFFLE9BQU8sT0FBTztBQUFBLEVBQ2hCLE9BQU87QUFBQSxJQUNMLHVCQUF1QjtBQUFBLElBQ3ZCLGVBQWU7QUFBQSxNQUNiLFFBQVE7QUFBQSxRQUNOLGNBQWM7QUFBQSxVQUNaLGdCQUFnQixDQUFDLFNBQVMsYUFBYSxrQkFBa0I7QUFBQSxVQUN6RCxhQUFhLENBQUMsaUJBQWlCLGdCQUFnQixRQUFRLGdCQUFnQjtBQUFBLFVBQ3ZFLG1CQUFtQixDQUFDLHVCQUF1QjtBQUFBLFVBQzNDLGdCQUFnQixDQUFDLFlBQVksT0FBTyxRQUFRO0FBQUEsUUFDOUM7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUssS0FBSyxRQUFRLGtDQUFXLE9BQU87QUFBQSxJQUN0QztBQUFBLEVBQ0Y7QUFDRixFQUFFOyIsCiAgIm5hbWVzIjogW10KfQo=
