import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    testTimeout: 30000, // 30s timeout for API tests
    hookTimeout: 30000,
    globals: false,
    include: ['tests/**/*.test.js'],
  },
});
