import type { PoolClient } from 'pg';
import { pool } from '../db/pool.js';
import { logger } from '../config/logger.js';

export interface NotifyInput {
  organizationId: string;
  userId: string;
  eventType: string;
  title: string;
  body?: string;
  link?: string;
  channel?: 'in_app' | 'email';
}

/**
 * Persiste uma notificação. Aceita um client de transação ou usa o pool.
 * O envio de e-mail é um stub (log) - trocar por provedor real (SES/SMTP).
 */
export async function notify(clientOrNull: PoolClient | null, input: NotifyInput): Promise<void> {
  const runner = clientOrNull ?? pool;
  await runner.query(
    `INSERT INTO notifications (organization_id, user_id, channel, event_type, title, body, link)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      input.organizationId,
      input.userId,
      input.channel ?? 'in_app',
      input.eventType,
      input.title,
      input.body ?? null,
      input.link ?? null,
    ],
  );

  if (input.channel === 'email') {
    logger.info({ to: input.userId, subject: input.title }, '[email stub] notificação enviada');
  }
}
