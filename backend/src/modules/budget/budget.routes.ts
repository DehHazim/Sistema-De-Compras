import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { auditContext, authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/http.js';

export const budgetRouter = Router();
budgetRouter.use(authenticate);

// Situação orçamentária consolidada
budgetRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const year = Number(req.query.year) || new Date().getFullYear();
    const { rows } = await query(
      `SELECT cc.code AS cost_center_code, cc.name AS cost_center_name,
              d.name AS department_name,
              vb.fiscal_year, vb.amount_planned, vb.amount_committed,
              vb.amount_executed, vb.amount_available
         FROM vw_budget_balance vb
         JOIN cost_centers cc ON cc.id = vb.cost_center_id
         LEFT JOIN departments d ON d.id = cc.department_id
        WHERE cc.organization_id = $1 AND vb.fiscal_year = $2
        ORDER BY cc.code`,
      [req.user!.org, year],
    );
    const totals = rows.reduce(
      (acc, r) => ({
        planned: acc.planned + Number(r.amount_planned),
        committed: acc.committed + Number(r.amount_committed),
        executed: acc.executed + Number(r.amount_executed),
        available: acc.available + Number(r.amount_available),
      }),
      { planned: 0, committed: 0, executed: 0, available: 0 },
    );
    res.json({ year, costCenters: rows, totals });
  }),
);

const budgetSchema = z.object({
  costCenterId: z.string().uuid(),
  fiscalYear: z.number().int().min(2000).max(2100),
  periodMonth: z.number().int().min(1).max(12).optional(),
  amountPlanned: z.number().min(0),
});

budgetRouter.post(
  '/',
  authorize('gestor', 'admin'),
  validate(budgetSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof budgetSchema>;
    const { rows } = await withTransaction(auditContext(req), (client) =>
      client.query(
        `INSERT INTO budgets (organization_id, cost_center_id, fiscal_year, period_month, amount_planned)
         VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (cost_center_id, fiscal_year, period_month)
         DO UPDATE SET amount_planned = EXCLUDED.amount_planned
         RETURNING *`,
        [req.user!.org, b.costCenterId, b.fiscalYear, b.periodMonth ?? null, b.amountPlanned],
      ),
    );
    res.status(201).json(rows[0]);
  }),
);
