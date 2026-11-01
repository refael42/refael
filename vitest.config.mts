import { defineConfig } from 'vitest/config';

// The simulation and economy are pure TypeScript, so tests run in plain Node with no RN/Expo shims.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    // Many tests run the sim for minutes of game time; on a busy machine the whole suite in
    // parallel can push one past the default 5 s.
    testTimeout: 30000,
  },
});
