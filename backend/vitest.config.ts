import { defineConfig } from 'vitest/config';

process.env.JWT_SECRET ??= 'chave-de-teste-suficientemente-grande';
process.env.DATABASE_URL ??= 'postgres://sic:sic@localhost:5432/sic';
process.env.NODE_ENV = 'test';

export default defineConfig({
  test: { include: ['test/**/*.test.ts'], environment: 'node' },
});
