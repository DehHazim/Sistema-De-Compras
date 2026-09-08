import pg from 'pg';
import { env } from '../config/env.js';

// numeric -> number (o schema usa numeric(14,2) para valores monetários)
pg.types.setTypeParser(1700, (v) => (v === null ? null : Number(v)));

export const pool = new pg.Pool({
  connectionString: env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
});

export type QueryParams = ReadonlyArray<unknown>;

export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  text: string,
  params?: QueryParams,
): Promise<pg.QueryResult<T>> {
  return pool.query<T>(text, params as unknown[]);
}

export interface AuditContext {
  userId?: string;
  ip?: string;
}

/**
 * Executa `fn` dentro de uma transação, propagando o ator para os triggers de
 * auditoria via `SET LOCAL app.current_user_id` / `app.client_ip`.
 */
export async function withTransaction<T>(
  ctx: AuditContext,
  fn: (client: pg.PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT set_config($1, $2, true), set_config($3, $4, true)', [
      'app.current_user_id',
      ctx.userId ?? '',
      'app.client_ip',
      ctx.ip ?? '',
    ]);
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
