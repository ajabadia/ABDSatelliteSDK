import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    core: 'src/core/index.ts',
    db: 'src/db/index.ts',
    logger: 'src/logger/index.ts',
    'event-bus': 'src/event-bus/index.ts',
    'auth-middleware': 'src/auth-middleware/index.ts',
    utils: 'src/utils/index.ts',
    styles: 'src/styles/index.ts',
    client: 'src/client.ts',
    contracts: 'src/contracts.ts',
  },
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ['react', 'react-dom', 'next', '@ajabadia/styles', 'next/server', 'next/headers'],
});
