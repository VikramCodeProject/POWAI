import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(async ({ mode }) => {
  let taggerPlugin: unknown = null;
  let pwaPlugin: unknown = null;

  if (mode === "development") {
    try {
      const tagger = await import("lovable-tagger");
      taggerPlugin = tagger.componentTagger();
    } catch {
      // Skip tagger plugin when dependency is not installed (e.g., CI/Render builds).
      taggerPlugin = null;
    }
  }

  try {
    const pwa = await import("vite-plugin-pwa");
    pwaPlugin = pwa.VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",
      includeAssets: ["pow.png", "robots.txt"],
      manifest: {
        name: "POWAI",
        short_name: "POWAI",
        description: "Academic integrity platform with behavioral analytics.",
        theme_color: "#0f172a",
        background_color: "#0f172a",
        display: "standalone",
        start_url: "/",
        scope: "/",
        icons: [
          {
            src: "/icons/pwa-192x192.png",
            sizes: "192x192",
            type: "image/png",
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
          },
          {
            src: "/icons/pwa-512x512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp}"],
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts",
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    });
  } catch {
    // Build should not fail if plugin install is missing in constrained environments.
    pwaPlugin = null;
  }

  return {
    server: {
      host: "::",
      port: 8080,
      strictPort: true,
      hmr: {
        overlay: true,
      },
      headers: {
        'Cache-Control': 'no-store',
      },
      proxy: {
        '/api': {
          target: 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
    plugins: [
      react(),
      pwaPlugin,
      taggerPlugin,
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
    },
  };
});
