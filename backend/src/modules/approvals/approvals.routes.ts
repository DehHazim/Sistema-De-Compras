import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { auditContext, authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/http.js';
import { decideApprovalStep } from '../../services/approvalEngine.js';

export const approvalsRouter = Router();
approvalsRouter.use(authenticate);

// Fila de aprovações pendentes para o usuário logado
approvalsRouter.get(
  '/inbox',
  authorize('aprovador', 'gestor', 'admin'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM vw_open_approvals WHERE approver_id = $1 ORDER BY waiting_since`,
      [req.user!.sub],
    );
    res.json({ data: rows });
  }),
);

const decisionSchema = z.object({
  decision: z.enum(['aprovado', 'reprovado']),
  comment: z.string().max(1000).optional(),
});

approvalsRouter.post(
  '/:requestId/decision',
  authorize('aprovador', 'gestor', 'admin'),
  validate(decisionSchema),
  asyncHandler(async (req, res) => {
    const { decision, comment } = req.body as z.infer<typeof decisionSchema>;
    const result = await withTransaction(auditContext(req), (client) =>
      decideApprovalStep(client, {
        requestId: req.params.requestId,
        approverId: req.user!.sub,
        decision,
        comment,
      }),
    );
    res.json(result);
  }),
);
