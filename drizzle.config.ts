import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: ['./auth-schema.ts', './src/db/schema.ts'],
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './data/qinhang.db',
  },
});
