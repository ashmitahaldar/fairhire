import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  // .env lives at the monorepo root (shared with the api workspace, which
  // reads it via --env-file=../.env). Without this, Vite defaults envDir to
  // web/ and silently skips loading VITE_* vars — main.tsx then throws on
  // the missing publishable key at module eval and React never mounts.
  envDir: '..',
  plugins: [react()],
  css: {
    // tailwind.config.ts lives in src/ (design drop), so point PostCSS at it
    // explicitly rather than relying on root auto-discovery.
    postcss: {
      plugins: [tailwindcss('./src/tailwind.config.ts'), autoprefixer()],
    },
  },
  test: {
    environment: 'jsdom',
    // api.ts reads VITE_API_BASE_URL at module load; provide it so test imports
    // (which pull in the data hooks) don't throw.
    env: { VITE_API_BASE_URL: 'http://localhost:3000' },
  },
});
