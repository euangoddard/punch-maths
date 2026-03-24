import { qwikCity } from "@builder.io/qwik-city/vite";
import { qwikVite } from "@builder.io/qwik/optimizer";
import tailwindcss from "@tailwindcss/vite";
import tsconfigPaths from "vite-tsconfig-paths";
import path from "path";
import { defineConfig } from "vite";

export default defineConfig(() => ({
  plugins: [
    qwikCity(),
    qwikVite(),
    tsconfigPaths({ root: "." }),
    tailwindcss(),
  ],
  optimizeDeps: {
    // Put problematic deps that break bundling here, mostly those with binaries.
    // For example ['better-sqlite3'] if you use that in server functions.
    include: [],
  },
  resolve: {
    tsconfigPaths: true,
    alias: {
      // @mediapipe/tasks-vision has a malformed exports field — point directly
      // at the ESM bundle to bypass it.
      "@mediapipe/tasks-vision": path.resolve(
        "./node_modules/@mediapipe/tasks-vision/vision_bundle.mjs",
      ),
    },
  },
  server: {
    headers: {
      // Don't cache the server response in dev mode
      "Cache-Control": "public, max-age=0",
    },
  },
  preview: {
    headers: {
      "Cache-Control": "public, max-age=600",
    },
  },
}));
