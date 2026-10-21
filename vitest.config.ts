import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src'), 'server-only': path.resolve(__dirname, 'tests/stubs/empty.ts'), 'next/headers': path.resolve(__dirname, 'tests/stubs/next-headers.ts') } },
  test: { environment: 'node', include: ['tests/**/*.test.ts'], testTimeout: 30000, fileParallelism: false },
});
