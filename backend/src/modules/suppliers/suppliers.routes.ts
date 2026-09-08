import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { auditContext, authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, notFound, paginate } from '../../utils/http.js';

export const suppliersRouter = Router();
suppliersRouter.use(authenticate);

const upsertSchema = z.object({
  legalName: z.string().min(2).max(160),
  tradeName: z.string().max(160).optional(),
  taxId: z.string().min(11).max(20),
  email: z.string().email().optional(),
  phone: z.string().max(30).optional(),
  address: z.record(z.string(), z.unknown()).default({}),
  status: z.enum(['ativo', 'inativo', 'bloqueado', 'homologacao']).default('homologacao'),
  categoryIds: z.array(z.string().uuid()).default([]),
  notes: z.string().optional(),
});

suppliersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = paginate(req.query);
    const { status, q } = req.query as Record<string, string>;
    const params: unknown[] = [req.user!.org];
    let where = 's.organization_id = $1 AND s.deleted_at IS NULL';
    if (status) {
      params.push(status);
      where += ` AND s.status = $${params.length}`;
    }
    if (q) {
      params.push(`%${q}%`);
      where += ` AND (s.legal_name ILIKE $${params.length} OR s.tax_id ILIKE $${params.length})`;
    }
    const { rows } = await query(
      `SELECT s.id, s.legal_name, s.trade_name, s.tax_id, s.email, s.status, s.rating_avg,
              (SELECT count(*)::int FROM purchase_orders po WHERE po.supplier_id = s.id) AS orders_count
         FROM suppliers s
        WHERE ${where}
        ORDER BY s.legal_name
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    res.json({ data: rows, page, pageSize });
  }),
);

suppliersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT * FROM suppliers WHERE id = $1 AND organization_id = $2 AND deleted_at IS NULL`,
      [req.params.id, req.user!.org],
    );
    if (!rows[0]) throw notFound('Fornecedor não encontrado');
    const { rows: cats } = await query(
      `SELECT c.id, c.name FROM supplier_categories sc
         JOIN categories c ON c.id = sc.category_id WHERE sc.supplier_id = $1`,
      [req.params.id],
    );
    const { rows: evals } = await query(
      `SELECT score_quality, score_deadline, score_price, comment, created_at
         FROM supplier_evaluations WHERE supplier_id = $1 ORDER BY created_at DESC LIMIT 20`,
      [req.params.id],
    );
    res.json({ ...rows[0], categories: cats, evaluations: evals });
  }),
);

suppliersRouter.post(
  '/',
  authorize('comprador', 'gestor', 'admin'),
  validate(upsertSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof upsertSchema>;
    const created = await withTransaction(auditContext(req), async (client) => {
      const { rows } = await client.query(
        `INSERT INTO suppliers
           (organization_id, legal_name, trade_name, tax_id, email, phone, address, status, notes, created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
        [
          req.user!.org, b.legalName, b.tradeName ?? null, b.taxId, b.email ?? null,
          b.phone ?? null, JSON.stringify(b.address), b.status, b.notes ?? null, req.user!.sub,
        ],
      );
      for (const catId of b.categoryIds) {
        await client.query(
          `INSERT INTO supplier_categories (supplier_id, category_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [rows[0].id, catId],
        );
      }
      return rows[0];
    });
    res.status(201).json(created);
  }),
);

suppliersRouter.patch(
  '/:id',
  authorize('comprador', 'gestor', 'admin'),
  validate(upsertSchema.partial()),
  asyncHandler(async (req, res) => {
    const b = req.body as Partial<z.infer<typeof upsertSchema>>;
    const map: Record<string, string> = {
      legalName: 'legal_name', tradeName: 'trade_name', taxId: 'tax_id',
      email: 'email', phone: 'phone', status: 'status', notes: 'notes',
    };
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const [k, col] of Object.entries(map)) {
      if (b[k as keyof typeof b] !== undefined) {
        params.push(b[k as keyof typeof b]);
        sets.push(`${col} = $${params.length}`);
      }
    }
    if (b.address !== undefined) {
      params.push(JSON.stringify(b.address));
      sets.push(`address = $${params.length}`);
    }
    if (!sets.length) return res.json({ updated: false });
    params.push(req.params.id, req.user!.org);
    const { rows } = await withTransaction(auditContext(req), (client) =>
      client.query(
        `UPDATE suppliers SET ${sets.join(', ')}
          WHERE id = $${params.length - 1} AND organization_id = $${params.length}
          RETURNING *`,
        params,
      ),
    );
    if (!rows[0]) throw notFound('Fornecedor não encontrado');
    res.json(rows[0]);
  }),
);

const evalSchema = z.object({
  purchaseOrderId: z.string().uuid().optional(),
  scoreQuality: z.number().int().min(1).max(5),
  scoreDeadline: z.number().int().min(1).max(5),
  scorePrice: z.number().int().min(1).max(5),
  comment: z.string().optional(),
});

suppliersRouter.post(
  '/:id/evaluations',
  authorize('comprador', 'gestor', 'admin'),
  validate(evalSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof evalSchema>;
    const { rows } = await withTransaction(auditContext(req), (client) =>
      client.query(
        `INSERT INTO supplier_evaluations
           (supplier_id, purchase_order_id, evaluator_id, score_quality, score_deadline, score_price, comment)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *`,
        [
          req.params.id, b.purchaseOrderId ?? null, req.user!.sub,
          b.scoreQuality, b.scoreDeadline, b.scorePrice, b.comment ?? null,
        ],
      ),
    );
    res.status(201).json(rows[0]);
  }),
);
