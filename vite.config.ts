/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

// GitHub Pages serves the site from /<repo>/; BASE_PATH is set by the deploy workflow.
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  // The e2e run points this at a directory holding fixture data so it never touches real data.
  publicDir: process.env.PUBLIC_DIR ?? 'public',
  plugins: [preact()],
  build: { target: 'es2020' },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts', 'tests/**/*.test.ts'],
    environment: 'node',
  },
});
