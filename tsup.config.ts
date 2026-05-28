import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/client.ts'],
  format: ['esm'],
  dts: true,
  splitting: true,
  sourcemap: true,
  clean: true,
  minify: false,
  external: ['react', 'react-dom', 'next', '@ajabadia/styles', 'next/server', 'next/headers'],
});
