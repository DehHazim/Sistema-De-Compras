import type { PoolClient } from 'pg';
import { badRequest } from '../utils/http.js';
import { notify } from './notifier.js';

/**
 * Motor de aprovação.
 *
 * Dado o valor estimado da solicitação, consulta `approval_rules` da organização
 * e monta a cadeia de níveis exigidos. Para cada nível escolhe um aprovador com
 * o papel exigido e alçada (`approval_limit`) suficiente. A solicitação avança
 * nível a nível; ao reprovar em qualquer etapa o fluxo encerra.
 */

interface Rule {
  level: number;
  approver_role: string;
  min_amount: number;
  max_amount: number | null;
}

export async function startApprovalFlow(
  client: PoolClient,
  opts: { requestId: string; organizationId: string; departmentId: string; categoryId: string | null; amount: number },
): Promise<void> {
  const { rows: rules } = await client.query<Rule>(
    `SELECT DISTINCT ON (level) level, approver_role, min_amount, max_amount
       FROM approval_rules
      WHERE organization_id = $1
        AND is_active
        AND (department_id IS NULL OR department_id = $2)
        AND (category_id   IS NULL OR category_id   = $3)
        AND $4 >= min_amount
        AND (max_amount IS NULL OR $4 <= max_amount OR min_amount <= $4)
      ORDER BY level, department_id NULLS LAST, category_id NULLS LAST`,
    [opts.organizationId, opts.departmentId, opts.categoryId, opts.amount],
  );

  // Todos os níveis cuja faixa inicia até o valor da compra são exigidos
  const requiredLevels = rules
    .filter((r) => opts.amount >= r.min_amount)
    .sort((a, b) => a.level - b.level);

  if (requiredLevels.length === 0) {
    throw badRequest('Nenhuma regra de aprovação configurada para este valor');
  }

  const { rows: wf } = await client.query(
    `INSERT INTO approval_workflows (request_id, current_level, status)
     VALUES ($1, $2, 'pendente') RETURNING id`,
    [opts.requestId, requiredLevels[0].level],
  );
  const workflowId = wf[0].id as string;

  for (const rule of requiredLevels) {
    const approverId = await pickApprover(client, opts.organizationId, rule.approver_role, opts.amount);
    await client.query(
      `INSERT INTO approval_steps (workflow_id, level, approver_id, decision)
       VALUES ($1, $2, $3, 'pendente')`,
      [workflowId, rule.level, approverId],
    );
  }

  await client.query(
    `UPDATE purchase_requests SET status = 'em_aprovacao', submitted_at = now() WHERE id = $1`,
    [opts.requestId],
  );

  await notifyLevel(client, workflowId, requiredLevels[0].level);
}

async function pickApprover(
  client: PoolClient,
  organizationId: string,
  role: string,
  amount: number,
): Promise<string | null> {
  const { rows } = await client.query(
    `SELECT id FROM users
      WHERE organization_id = $1 AND role = $2 AND is_active AND deleted_at IS NULL
      ORDER BY (approval_limit >= $3) DESC, approval_limit DESC
      LIMIT 1`,
    [organizationId, role, amount],
  );
  return rows[0]?.id ?? null;
}

async function notifyLevel(client: PoolClient, workflowId: string, level: number) {
  const { rows } = await client.query(
    `SELECT s.approver_id, pr.id AS request_id, pr.number, pr.title, pr.organization_id
       FROM approval_steps s
       JOIN approval_workflows w ON w.id = s.workflow_id
       JOIN purchase_requests pr ON pr.id = w.request_id
      WHERE s.workflow_id = $1 AND s.level = $2`,
    [workflowId, level],
  );
  for (const r of rows) {
    if (!r.approver_id) continue;
    await notify(client, {
      organizationId: r.organization_id,
      userId: r.approver_id,
      eventType: 'approval.pending',
      title: `Aprovação pendente: ${r.number}`,
      body: r.title,
      link: `/solicitacoes/${r.request_id}`,
    });
  }
}

export async function decideApprovalStep(
  client: PoolClient,
  opts: { requestId: string; approverId: string; decision: 'aprovado' | 'reprovado'; comment?: string },
): Promise<{ workflowStatus: string; requestStatus: string }> {
  const { rows: wfRows } = await client.query(
    `SELECT w.id, w.current_level, w.status
       FROM approval_workflows w WHERE w.request_id = $1 FOR UPDATE`,
    [opts.requestId],
  );
  const wf = wfRows[0];
  if (!wf) throw badRequest('Solicitação sem fluxo de aprovação');
  if (wf.status !== 'pendente') throw badRequest('Fluxo de aprovação já encerrado');

  const { rows: stepRows } = await client.query(
    `SELECT id, approver_id FROM approval_steps
      WHERE workflow_id = $1 AND level = $2 AND decision = 'pendente' FOR UPDATE`,
    [wf.id, wf.current_level],
  );
  const step = stepRows[0];
  if (!step) throw badRequest('Nenhuma etapa pendente neste nível');
  if (step.approver_id !== opts.approverId) {
    throw badRequest('Usuário não é o aprovador designado para este nível');
  }

  await client.query(
    `UPDATE approval_steps SET decision = $1, comment = $2, decided_at = now() WHERE id = $3`,
    [opts.decision, opts.comment ?? null, step.id],
  );

  if (opts.decision === 'reprovado') {
    await client.query(
      `UPDATE approval_workflows SET status = 'reprovado', finished_at = now() WHERE id = $1`,
      [wf.id],
    );
    await client.query(`UPDATE purchase_requests SET status = 'reprovada' WHERE id = $1`, [
      opts.requestId,
    ]);
    await notifyRequester(client, opts.requestId, 'approval.rejected', 'Solicitação reprovada');
    return { workflowStatus: 'reprovado', requestStatus: 'reprovada' };
  }

  // aprovado: existe próximo nível?
  const { rows: next } = await client.query(
    `SELECT level FROM approval_steps
      WHERE workflow_id = $1 AND level > $2 AND decision = 'pendente'
      ORDER BY level LIMIT 1`,
    [wf.id, wf.current_level],
  );

  if (next[0]) {
    await client.query(`UPDATE approval_workflows SET current_level = $1 WHERE id = $2`, [
      next[0].level,
      wf.id,
    ]);
    await notifyLevel(client, wf.id, next[0].level);
    return { workflowStatus: 'pendente', requestStatus: 'em_aprovacao' };
  }

  await client.query(
    `UPDATE approval_workflows SET status = 'aprovado', finished_at = now() WHERE id = $1`,
    [wf.id],
  );
  await client.query(`UPDATE purchase_requests SET status = 'aprovada' WHERE id = $1`, [
    opts.requestId,
  ]);
  await notifyRequester(client, opts.requestId, 'approval.approved', 'Solicitação aprovada');
  return { workflowStatus: 'aprovado', requestStatus: 'aprovada' };
}

async function notifyRequester(
  client: PoolClient,
  requestId: string,
  eventType: string,
  title: string,
) {
  const { rows } = await client.query(
    `SELECT requester_id, organization_id, number FROM purchase_requests WHERE id = $1`,
    [requestId],
  );
  const r = rows[0];
  if (!r) return;
  await notify(client, {
    organizationId: r.organization_id,
    userId: r.requester_id,
    eventType,
    title: `${title}: ${r.number}`,
    link: `/solicitacoes/${requestId}`,
  });
}
