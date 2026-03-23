import { defineConfig, fontProviders } from 'astro/config';
import preact from '@astrojs/preact';
import critters from 'astro-critters';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  integrations: [preact(), critters()],
  fonts: [
    {
      provider: fontProviders.google(),
      name: 'Anton',
      cssVariable: '--font-display',
    },
    {
      provider: fontProviders.google(),
      name: 'Nunito',
      cssVariable: '--font-body',
      weights: [400, 600, 700, 800, 900],
    },
  ],
  vite: {
    plugins: [tailwindcss()],
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
  },
});
