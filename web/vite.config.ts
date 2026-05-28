import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from 'tailwindcss';
import autoprefixer from 'autoprefixer';

export default defineConfig({
  plugins: [react()],
  css: {
    // tailwind.config.ts lives in src/ (design drop), so point PostCSS at it
    // explicitly rather than relying on root auto-discovery.
    postcss: {
      plugins: [tailwindcss('./src/tailwind.config.ts'), autoprefixer()],
    },
  },
});
