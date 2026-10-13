import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['./test/support/global-setup.ts'],
    // Files share one database and truncate tables: run them one after another.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
});
