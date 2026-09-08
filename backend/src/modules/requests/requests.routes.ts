import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { auditContext, authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, badRequest, notFound, paginate } from '../../utils/http.js';
import { startApprovalFlow } from '../../services/approvalEngine.js';

export const requestsRouter = Router();
requestsRouter.use(authenticate);

const itemSchema = z.object({
  description: z.string().min(2).max(255),
  unit: z.string().max(15).default('un'),
  quantity: z.number().positive(),
  estimatedPrice: z.number().min(0).default(0),
});

const createSchema = z.object({
  departmentId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
  title: z.string().min(3).max(160),
  justification: z.string().min(5),
  priority: z.enum(['baixa', 'normal', 'alta', 'urgente']).default('normal'),
  neededBy: z.string().date().optional(),
  items: z.array(itemSchema).min(1),
});

// -------------------------------------------------------------------- LISTAR
requestsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = paginate(req.query);
    const { status, q } = req.query as Record<string, string>;
    const params: unknown[] = [req.user!.org];
    let where = 'pr.organization_id = $1 AND pr.deleted_at IS NULL';

    // Solicitante só enxerga as próprias
    if (req.user!.role === 'solicitante') {
      params.push(req.user!.sub);
      where += ` AND pr.requester_id = $${params.length}`;
    }
    if (status) {
      params.push(status);
      where += ` AND pr.status = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (pr.title ILIKE $${params.length} OR pr.number ILIKE $${params.length})`;
    }

    const { rows } = await query(
      `SELECT pr.id, pr.number, pr.title, pr.status, pr.priority, pr.estimated_total,
              pr.needed_by, pr.created_at,
              u.full_name AS requester, d.name AS department
         FROM purchase_requests pr
         JOIN users u ON u.id = pr.requester_id
         JOIN departments d ON d.id = pr.department_id
        WHERE ${where}
        ORDER BY pr.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    const { rows: count } = await query(
      `SELECT count(*)::int AS total FROM purchase_requests pr WHERE ${where}`,
      params,
    );
    res.json({ data: rows, page, pageSize, total: count[0].total });
  }),
);

// -------------------------------------------------------------------- DETALHE
requestsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT pr.*, u.full_name AS requester_name, d.name AS department_name,
              cc.name AS cost_center_name
         FROM purchase_requests pr
         JOIN users u ON u.id = pr.requester_id
         JOIN departments d ON d.id = pr.department_id
         JOIN cost_centers cc ON cc.id = pr.cost_center_id
        WHERE pr.id = $1 AND pr.organization_id = $2 AND pr.deleted_at IS NULL`,
      [req.params.id, req.user!.org],
    );
    if (!rows[0]) throw notFound('Solicitação não encontrada');

    const { rows: items } = await query(
      `SELECT id, line_no, description, unit, quantity, estimated_price
         FROM purchase_request_items WHERE request_id = $1 ORDER BY line_no`,
      [req.params.id],
    );
    const { rows: steps } = await query(
      `SELECT s.level, s.decision, s.comment, s.decided_at, u.full_name AS approver
         FROM approval_steps s
         JOIN approval_workflows w ON w.id = s.workflow_id
         LEFT JOIN users u ON u.id = s.approver_id
        WHERE w.request_id = $1 ORDER BY s.level`,
      [req.params.id],
    );
    res.json({ ...rows[0], items, approvalSteps: steps });
  }),
);

// -------------------------------------------------------------------- CRIAR
requestsRouter.post(
  '/',
  authorize('solicitante', 'comprador', 'gestor', 'admin'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createSchema>;
    const estimatedTotal = body.items.reduce(
      (acc, it) => acc + it.quantity * it.estimatedPrice,
      0,
    );

    const request = await withTransaction(auditContext(req), async (client) => {
      const { rows } = await client.query(
        `INSERT INTO purchase_requests
           (organization_id, requester_id, department_id, cost_center_id, category_id,
            title, justification, priority, needed_by, estimated_total, status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'rascunho')
         RETURNING id, number`,
        [
          req.user!.org,
          req.user!.sub,
          body.departmentId,
          body.costCenterId,
          body.categoryId ?? null,
          body.title,
          body.justification,
          body.priority,
          body.neededBy ?? null,
          estimatedTotal,
        ],
      );
      const reqId = rows[0].id as string;
      let line = 1;
      for (const it of body.items) {
        await client.query(
          `INSERT INTO purchase_request_items
             (request_id, line_no, description, unit, quantity, estimated_price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [reqId, line++, it.description, it.unit, it.quantity, it.estimatedPrice],
        );
      }
      return rows[0];
    });

    res.status(201).json(request);
  }),
);

// -------------------------------------------------------------------- SUBMETER
requestsRouter.post(
  '/:id/submit',
  asyncHandler(async (req, res) => {
    const result = await withTransaction(auditContext(req), async (client) => {
      const { rows } = await client.query(
        `SELECT id, requester_id, department_id, category_id, estimated_total, status
           FROM purchase_requests
          WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [req.params.id, req.user!.org],
      );
      const pr = rows[0];
      if (!pr) throw notFound('Solicitação não encontrada');
      if (pr.requester_id !== req.user!.sub && !['admin', 'gestor'].includes(req.user!.role)) {
        throw badRequest('Somente o solicitante pode submeter');
      }
      if (pr.status !== 'rascunho' && pr.status !== 'reprovada') {
        throw badRequest(`Solicitação no status "${pr.status}" não pode ser submetida`);
      }
      if (pr.estimated_total <= 0) throw badRequest('Valor estimado deve ser maior que zero');

      await startApprovalFlow(client, {
        requestId: pr.id,
        organizationId: req.user!.org,
        departmentId: pr.department_id,
        categoryId: pr.category_id,
        amount: pr.estimated_total,
      });
      return { id: pr.id, status: 'em_aprovacao' };
    });
    res.json(result);
  }),
);

// -------------------------------------------------------------------- CANCELAR
requestsRouter.post(
  '/:id/cancel',
  asyncHandler(async (req, res) => {
    const { rowCount } = await query(
      `UPDATE purchase_requests
          SET status = 'cancelada', closed_at = now()
        WHERE id = $1 AND organization_id = $2
          AND status IN ('rascunho','em_aprovacao','aprovada','reprovada')`,
      [req.params.id, req.user!.org],
    );
    if (!rowCount) throw badRequest('Solicitação não pode ser cancelada neste status');
    res.json({ id: req.params.id, status: 'cancelada' });
  }),
);
