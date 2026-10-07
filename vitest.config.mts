import { defineConfig } from 'vitest/config';

// The simulation and economy are pure TypeScript, so tests run in plain Node with no RN/Expo shims.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
