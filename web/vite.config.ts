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
  // @fairhire/shared is a workspace package that emits CommonJS — without
  // pre-bundling, Vite serves its dist files via /@fs and the browser fails
  // on named imports ("does not provide an export named X") as soon as the
  // CJS export set changes between rebuilds. Forcing optimizeDeps wraps it
  // in an ESM shim and keeps named exports stable. Re-run web after every
  // shared rebuild so this picks up the new export set.
  optimizeDeps: {
    include: ['@fairhire/shared'],
  },
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
