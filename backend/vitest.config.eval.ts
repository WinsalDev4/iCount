import { defineConfig } from 'vitest/config';

/**
 * Live evaluation of the AI advisor against the real model (ADR-0020).
 * Costs money: never part of CI. Run with ANTHROPIC_API_KEY set:
 * `npm run eval:advisor -w @icount/backend`.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['src/**/*.live-eval.ts'],
    testTimeout: 180_000,
  },
});
