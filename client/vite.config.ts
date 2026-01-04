import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import svgr from "vite-plugin-svgr";

const port = parseInt(process.env.FRONTEND_PORT || "5173", 10);
const backendPort = parseInt(process.env.BACKEND_PORT || "8000", 10);

export default defineConfig({
  base: "",
  plugins: [react(), svgr()],
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
