import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['**/*.test.ts'],
    globals: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'scripts/**',
        '**/*.test.ts',
        'vitest.config.ts',
        'tsup.config.ts',
      ],
    },
  },
});
