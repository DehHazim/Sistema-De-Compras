import { pool } from '../db/pool.js';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { notify } from '../services/notifier.js';

/**
 * Job periódico de alertas. Em produção use um scheduler dedicado (BullMQ, cron,
 * pg_cron). Aqui um setInterval simples cobre o MVP.
 */
async function runOnce(): Promise<void> {
  // 1) Contratos vencendo
  const { rows: contracts } = await pool.query(
    `SELECT c.id, c.code, c.description, c.end_date, c.organization_id
       FROM contracts c
      WHERE c.is_active
        AND c.end_date BETWEEN current_date AND current_date + ($1 || ' days')::interval
        AND NOT EXISTS (
          SELECT 1 FROM notifications n
           WHERE n.event_type = 'contract.expiring'
             AND n.link = '/contratos/' || c.id
             AND n.created_at > now() - interval '7 days')`,
    [env.CONTRACT_ALERT_DAYS],
  );
  for (const c of contracts) {
    const { rows: admins } = await pool.query(
      `SELECT id FROM users WHERE organization_id = $1 AND role IN ('gestor','admin') AND is_active`,
      [c.organization_id],
    );
    for (const a of admins) {
      await notify(null, {
        organizationId: c.organization_id,
        userId: a.id,
        eventType: 'contract.expiring',
        title: `Contrato ${c.code} vence em breve`,
        body: `${c.description} — vencimento ${c.end_date.toISOString().slice(0, 10)}`,
        link: `/contratos/${c.id}`,
      });
    }
  }

  // 2) Aprovações paradas há mais de 48h
  const { rows: stale } = await pool.query(
    `SELECT s.approver_id, pr.number, pr.id AS request_id, pr.organization_id
       FROM approval_steps s
       JOIN approval_workflows w ON w.id = s.workflow_id
       JOIN purchase_requests pr ON pr.id = w.request_id
      WHERE s.decision = 'pendente' AND w.status = 'pendente'
        AND s.created_at < now() - interval '48 hours'
        AND s.approver_id IS NOT NULL`,
  );
  for (const s of stale) {
    await notify(null, {
      organizationId: s.organization_id,
      userId: s.approver_id,
      eventType: 'approval.reminder',
      title: `Lembrete: aprovação pendente ${s.number}`,
      link: `/solicitacoes/${s.request_id}`,
    });
  }

  if (contracts.length || stale.length) {
    logger.info({ contracts: contracts.length, staleApprovals: stale.length }, 'Alertas emitidos');
  }
}

export function startAlertsJob(): void {
  const intervalMs = env.ALERTS_INTERVAL_MINUTES * 60_000;
  runOnce().catch((err) => logger.error({ err }, 'Falha no job de alertas'));
  setInterval(() => {
    runOnce().catch((err) => logger.error({ err }, 'Falha no job de alertas'));
  }, intervalMs).unref();
  logger.info(`Job de alertas ativo (cada ${env.ALERTS_INTERVAL_MINUTES} min)`);
}
