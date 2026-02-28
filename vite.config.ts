import path from "path";
import tailwindcss from "@tailwindcss/vite";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target:
          process.env.VITE_AUTH_API_PROXY_TARGET || "http://localhost:8787",
        changeOrigin: true,
        rewrite: (pathValue) => pathValue.replace(/^\/api/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
