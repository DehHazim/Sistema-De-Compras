import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { auditContext, authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, badRequest, notFound, paginate } from '../../utils/http.js';

export const purchaseOrdersRouter = Router();
purchaseOrdersRouter.use(authenticate);

purchaseOrdersRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = paginate(req.query);
    const { status } = req.query as Record<string, string>;
    const params: unknown[] = [req.user!.org];
    let where = 'po.organization_id = $1';
    if (status) {
      params.push(status);
      where += ` AND po.status = $${params.length}`;
    }
    const { rows } = await query(
      `SELECT po.id, po.number, po.status, po.total_amount, po.expected_date, po.issued_at,
              s.legal_name AS supplier_name, pr.number AS request_number
         FROM purchase_orders po
         JOIN suppliers s ON s.id = po.supplier_id
         JOIN purchase_requests pr ON pr.id = po.request_id
        WHERE ${where}
        ORDER BY po.issued_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    res.json({ data: rows, page, pageSize });
  }),
);

purchaseOrdersRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT po.*, s.legal_name AS supplier_name, s.tax_id AS supplier_tax_id
         FROM purchase_orders po JOIN suppliers s ON s.id = po.supplier_id
        WHERE po.id = $1 AND po.organization_id = $2`,
      [req.params.id, req.user!.org],
    );
    if (!rows[0]) throw notFound('Pedido não encontrado');
    const { rows: items } = await query(
      `SELECT line_no, description, unit, quantity, unit_price, received_qty, line_total
         FROM purchase_order_items WHERE purchase_order_id = $1 ORDER BY line_no`,
      [req.params.id],
    );
    res.json({ ...rows[0], items });
  }),
);

const createSchema = z.object({
  quotationId: z.string().uuid(),
  costCenterId: z.string().uuid(),
  expectedDate: z.string().date().optional(),
  paymentTerms: z.string().max(120).optional(),
  freightAmount: z.number().min(0).default(0),
  discountAmount: z.number().min(0).default(0),
});

// Emitir pedido a partir da proposta vencedora de uma cotação
purchaseOrdersRouter.post(
  '/',
  authorize('comprador', 'gestor', 'admin'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof createSchema>;
    const po = await withTransaction(auditContext(req), async (client) => {
      const { rows: offer } = await client.query(
        `SELECT o.id, o.supplier_id, o.total_amount, o.payment_terms, q.request_id
           FROM quotation_offers o JOIN quotations q ON q.id = o.quotation_id
          WHERE q.id = $1 AND o.is_selected AND q.organization_id = $2`,
        [b.quotationId, req.user!.org],
      );
      if (!offer[0]) throw badRequest('Cotação sem proposta selecionada');

      const { rows: items } = await client.query(
        `SELECT ri.description, ri.unit, oi.quantity, oi.unit_price
           FROM quotation_offer_items oi
           JOIN purchase_request_items ri ON ri.id = oi.request_item_id
          WHERE oi.offer_id = $1`,
        [offer[0].id],
      );
      const subtotal = items.reduce((acc, it) => acc + Number(it.unit_price) * Number(it.quantity), 0);
      const total = subtotal + b.freightAmount - b.discountAmount;

      const { rows } = await client.query(
        `INSERT INTO purchase_orders
           (organization_id, request_id, quotation_offer_id, supplier_id, cost_center_id, issued_by,
            payment_terms, expected_date, subtotal, freight_amount, discount_amount, total_amount)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
         RETURNING id, number, total_amount`,
        [
          req.user!.org, offer[0].request_id, offer[0].id, offer[0].supplier_id, b.costCenterId,
          req.user!.sub, b.paymentTerms ?? offer[0].payment_terms, b.expectedDate ?? null,
          subtotal, b.freightAmount, b.discountAmount, total,
        ],
      );
      let line = 1;
      for (const it of items) {
        await client.query(
          `INSERT INTO purchase_order_items
             (purchase_order_id, line_no, description, unit, quantity, unit_price)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [rows[0].id, line++, it.description, it.unit, it.quantity, it.unit_price],
        );
      }
      await client.query(`UPDATE purchase_requests SET status = 'em_pedido' WHERE id = $1`, [
        offer[0].request_id,
      ]);

      // Compromete orçamento do centro de custo (ano corrente)
      await client.query(
        `INSERT INTO budget_movements (budget_id, movement_type, amount, source_table, source_id, created_by)
         SELECT b.id, 'comprometido', $1, 'purchase_orders', $2, $3
           FROM budgets b
          WHERE b.cost_center_id = $4 AND b.fiscal_year = EXTRACT(YEAR FROM now())::int
          ORDER BY b.period_month NULLS FIRST LIMIT 1`,
        [total, rows[0].id, req.user!.sub, b.costCenterId],
      );
      return rows[0];
    });
    res.status(201).json(po);
  }),
);

const statusSchema = z.object({
  status: z.enum([
    'enviado_fornecedor', 'confirmado', 'recebido_parcial', 'recebido', 'faturado', 'cancelado',
  ]),
});

purchaseOrdersRouter.patch(
  '/:id/status',
  authorize('comprador', 'gestor', 'admin'),
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const { status } = req.body as z.infer<typeof statusSchema>;
    const result = await withTransaction(auditContext(req), async (client) => {
      const { rows } = await client.query(
        `UPDATE purchase_orders SET status = $1
          WHERE id = $2 AND organization_id = $3
          RETURNING id, status, total_amount, cost_center_id, request_id`,
        [status, req.params.id, req.user!.org],
      );
      if (!rows[0]) throw notFound('Pedido não encontrado');

      if (status === 'recebido' || status === 'faturado') {
        await client.query(
          `INSERT INTO budget_movements (budget_id, movement_type, amount, source_table, source_id, created_by)
           SELECT b.id, 'realizado', $1, 'purchase_orders', $2, $3
             FROM budgets b
            WHERE b.cost_center_id = $4 AND b.fiscal_year = EXTRACT(YEAR FROM now())::int
            ORDER BY b.period_month NULLS FIRST LIMIT 1`,
          [rows[0].total_amount, rows[0].id, req.user!.sub, rows[0].cost_center_id],
        );
        await client.query(`UPDATE purchase_requests SET status = 'concluida', closed_at = now() WHERE id = $1`, [
          rows[0].request_id,
        ]);
      }
      if (status === 'cancelado') {
        await client.query(
          `INSERT INTO budget_movements (budget_id, movement_type, amount, source_table, source_id, created_by)
           SELECT b.id, 'estorno', $1, 'purchase_orders', $2, $3
             FROM budgets b
            WHERE b.cost_center_id = $4 AND b.fiscal_year = EXTRACT(YEAR FROM now())::int
            ORDER BY b.period_month NULLS FIRST LIMIT 1`,
          [rows[0].total_amount, rows[0].id, req.user!.sub, rows[0].cost_center_id],
        );
      }
      return rows[0];
    });
    res.json(result);
  }),
);
