import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    // Fixed regardless of any local .env, so tests exercising the "TomTom
    // key present" branch (geocoding.test.ts, tomtomRouting.test.ts) behave
    // the same everywhere instead of depending on a real key being set.
    env: {
      VITE_TOMTOM_API_KEY: 'test-tomtom-key',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/**/*.test.{ts,tsx}', 'src/test/**', 'src/main.tsx', 'src/**/*.d.ts'],
    },
  },
})
