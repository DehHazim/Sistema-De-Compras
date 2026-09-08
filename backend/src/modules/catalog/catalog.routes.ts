import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { auditContext, authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../utils/http.js';

// Endpoints de apoio: estrutura organizacional, categorias, usuários, regras de aprovação
export const catalogRouter = Router();
catalogRouter.use(authenticate);

catalogRouter.get(
  '/departments',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, code, name, parent_id FROM departments
        WHERE organization_id = $1 AND is_active ORDER BY name`,
      [req.user!.org],
    );
    res.json(rows);
  }),
);

catalogRouter.get(
  '/cost-centers',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, code, name, department_id FROM cost_centers
        WHERE organization_id = $1 AND is_active ORDER BY code`,
      [req.user!.org],
    );
    res.json(rows);
  }),
);

catalogRouter.get(
  '/categories',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, name, kind, parent_id FROM categories
        WHERE organization_id = $1 AND is_active ORDER BY name`,
      [req.user!.org],
    );
    res.json(rows);
  }),
);

catalogRouter.get(
  '/users',
  authorize('gestor', 'admin', 'comprador'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, full_name, email, role, approval_limit, is_active
         FROM users WHERE organization_id = $1 AND deleted_at IS NULL ORDER BY full_name`,
      [req.user!.org],
    );
    res.json(rows);
  }),
);

// ---- Regras de aprovação (configuráveis por alçada) ----
catalogRouter.get(
  '/approval-rules',
  authorize('gestor', 'admin'),
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT id, department_id, category_id, min_amount, max_amount, level, approver_role, is_active
         FROM approval_rules WHERE organization_id = $1 ORDER BY level, min_amount`,
      [req.user!.org],
    );
    res.json(rows);
  }),
);

const ruleSchema = z.object({
  departmentId: z.string().uuid().nullable().optional(),
  categoryId: z.string().uuid().nullable().optional(),
  minAmount: z.number().min(0),
  maxAmount: z.number().positive().nullable().optional(),
  level: z.number().int().min(1).max(10),
  approverRole: z.enum(['aprovador', 'gestor', 'admin']),
});

catalogRouter.post(
  '/approval-rules',
  authorize('admin'),
  validate(ruleSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof ruleSchema>;
    const { rows } = await withTransaction(auditContext(req), (client) =>
      client.query(
        `INSERT INTO approval_rules
           (organization_id, department_id, category_id, min_amount, max_amount, level, approver_role)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          req.user!.org, b.departmentId ?? null, b.categoryId ?? null,
          b.minAmount, b.maxAmount ?? null, b.level, b.approverRole,
        ],
      ),
    );
    res.status(201).json(rows[0]);
  }),
);
