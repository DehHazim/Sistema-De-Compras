/**
 * Aplica o schema físico e, opcionalmente, o seed.
 * Uso: npm run migrate            (schema)
 *      npm run migrate -- --seed  (schema + seed)
 */
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool } from '../src/db/pool.js';

const here = dirname(fileURLToPath(import.meta.url));
const dbDir = resolve(here, '../../database');

async function run(file: string) {
  const sql = await readFile(resolve(dbDir, file), 'utf8');
  await pool.query(sql);
  console.log(`✔ ${file} aplicado`);
}

(async () => {
  await run('schema.sql');
  if (process.argv.includes('--seed')) await run('seed.sql');
  await pool.end();
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
