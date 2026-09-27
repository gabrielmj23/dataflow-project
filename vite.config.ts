import path from "path";
import tailwindcss from "@tailwindcss/vite";

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      // Assets estáticos del directorio public/ que deben precachearse
      includeAssets: [
        "nodeland-mini.png",
        "nodeland-mini-dark.png",
        "nodeland-mini-white.png",
        "nodeland-dark.png",
        "nodeland-dark-alt.png",
        "nodeland-white.png",
        "nodeland.png",
        "lego-bricks-nobg.png",
        "shapes-nobg.png",
        "nodi-robot-head-nobg.png",
        "logo-nodi.png",
        "zipper.png",
        "trophy.png",
        "click.mp3",
        "correct.mp3",
        "pop.mp3",
        "icons/icon-192x192.png",
        "icons/icon-512x512.png",
      ],
      manifest: {
        name: "NodeLand",
        short_name: "NodeLand",
        description: "Editor visual de programas con nodos para niños y jóvenes",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        scope: "/",
        start_url: "/",
        lang: "es",
        icons: [
          {
            src: "/icons/icon-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/icon-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },
      workbox: {
        // Sirve index.html para cualquier navegación (SPA fallback)
        navigateFallback: "/index.html",
        // Las rutas de la API nunca se interceptan con el fallback de navegación
        navigateFallbackDenylist: [/^\/api/],
        // Aumentamos el límite a 10 MiB para cubrir el bundle principal de la app.
        // Los shards de los modelos ML (TensorFlow/NSFWJS) se excluyen del precache
        // porque son muy pesados (>5 MiB c/u) y solo se necesitan cuando se usa
        // la función de moderación de contenido con conexión.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
        globIgnores: [
          "**/group1-shard*.min-*.js",
          "**/group1-shard1of1.min-*.js",
        ],
        runtimeCaching: [
          {
            // Fuentes de Google — StaleWhileRevalidate (usa caché, actualiza en background)
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "StaleWhileRevalidate",
            options: {
              cacheName: "google-fonts",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365, // 1 año
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Assets estáticos de Vite (JS, CSS, imágenes, fuentes, audio) — CacheFirst
            urlPattern:
              /\.(?:js|css|woff2?|ttf|eot|png|jpg|jpeg|svg|webp|mp3|gif)$/,
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 días
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
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
