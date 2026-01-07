import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from 'vite-plugin-pwa';
import svgr from "vite-plugin-svgr";

const port = parseInt(process.env.FRONTEND_PORT || "5173", 10);
const backendPort = parseInt(process.env.BACKEND_PORT || "8000", 10);

export default defineConfig({
  base: "",
  plugins: [react(), svgr(),
      VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      includeAssets: ['favicon.ico', 'favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: "Spoolman",
        short_name: "Spoolman",
        description: "Keep track of your inventory of 3D-printer filament spools.",
        icons: [
          {
            purpose: "maskable",
            sizes: "512x512",
            src: "icon512_maskable.png",
            type: "image/png",
          },
          {
            purpose: "any",
            sizes: "512x512",
            src: "icon512_rounded.png",
            type: "image/png",
          },
          {
            purpose: "any",
            sizes: "192x192",
            src: "icon192_rounded.png",
            type: "image/png",
          },
        ],
        background_color: "#1F1F1F",
        theme_color: "#DC7734",
        display: "standalone",
        start_url: "/",
        scope: "/",
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  server: {
    host: "0.0.0.0",
    port: port,
    strictPort: true,
    proxy: {
      "/config.js": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
      "/api": {
        target: `http://localhost:${backendPort}`,
        changeOrigin: true,
      },
    },
  },
});
