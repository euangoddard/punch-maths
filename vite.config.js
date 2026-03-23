import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { vitePrerenderPlugin } from 'vite-prerender-plugin'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  plugins: [tailwindcss(), preact(), vitePrerenderPlugin({ renderTarget: '#app' })],
  resolve: {
    alias: {
      // @mediapipe/tasks-vision has a malformed exports field that Rolldown rejects;
      // point directly at the ESM bundle to bypass it.
      '@mediapipe/tasks-vision': path.resolve(
        __dirname,
        'node_modules/@mediapipe/tasks-vision/vision_bundle.mjs'
      ),
    },
  },
})
