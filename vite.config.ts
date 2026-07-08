import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base './' so the build works on GitHub Pages subpaths and itch.io zips
export default defineConfig({
  base: './',
  plugins: [react()],
  // Honor PORT from tooling (e.g. preview harness); Vite default otherwise.
  server: process.env.PORT ? { port: Number(process.env.PORT) } : undefined,
});
