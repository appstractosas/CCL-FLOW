/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
    // Windows con rutas que contienen espacios no soporta el pool "forks".
    pool: 'threads',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/components/**', 'src/store/**', 'src/utils/**', 'src/services/**', 'src/hooks/**'],
      exclude: ['src/components/auth/**', 'src/**/*.test.*', 'src/tests/**'],
      thresholds: {
        // Cobertura real: 70.43% lines. Umbrales con margen para no fallar en oscilaciones.
        lines: 68,
        functions: 65,
        branches: 60,
        statements: 64,
      },
    },
  },
});
