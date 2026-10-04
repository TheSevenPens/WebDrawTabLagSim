import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    svelte({
      // In CI, treat compiler warnings (including a11y) as failures
      onwarn(warning, handler) {
        if (process.env.CI) {
          throw new Error(`${warning.filename}:${warning.start?.line} ${warning.code}: ${warning.message}`);
        }
        handler(warning);
      },
    }),
  ],
  base: '/WebDrawTabLagSim/',
  resolve: {
    alias: {
      $lib: resolve('./src/lib'),
    },
  },
});
