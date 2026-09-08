import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../../db/pool.js';
import { auditContext, authenticate, authorize } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, badRequest, notFound } from '../../utils/http.js';

export const quotationsRouter = Router();
quotationsRouter.use(authenticate);

const createSchema = z.object({
  requestId: z.string().uuid(),
  deadline: z.string().date().optional(),
  supplierIds: z.array(z.string().uuid()).min(1),
});

// Abrir cotação a partir de uma solicitação aprovada
quotationsRouter.post(
  '/',
  authorize('comprador', 'gestor', 'admin'),
  validate(createSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof createSchema>;
    const result = await withTransaction(auditContext(req), async (client) => {
      const { rows: pr } = await client.query(
        `SELECT id, status FROM purchase_requests
          WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [b.requestId, req.user!.org],
      );
      if (!pr[0]) throw notFound('Solicitação não encontrada');
      if (!['aprovada', 'em_cotacao'].includes(pr[0].status)) {
        throw badRequest('Solicitação precisa estar aprovada para cotação');
      }
      const { rows: q } = await client.query(
        `INSERT INTO quotations (organization_id, request_id, buyer_id, deadline)
         VALUES ($1,$2,$3,$4) RETURNING id, number`,
        [req.user!.org, b.requestId, req.user!.sub, b.deadline ?? null],
      );
      for (const supplierId of b.supplierIds) {
        await client.query(
          `INSERT INTO quotation_offers (quotation_id, supplier_id) VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [q[0].id, supplierId],
        );
      }
      await client.query(`UPDATE purchase_requests SET status = 'em_cotacao' WHERE id = $1`, [
        b.requestId,
      ]);
      return q[0];
    });
    res.status(201).json(result);
  }),
);

quotationsRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT q.*, pr.number AS request_number, pr.title AS request_title
         FROM quotations q JOIN purchase_requests pr ON pr.id = q.request_id
        WHERE q.id = $1 AND q.organization_id = $2`,
      [req.params.id, req.user!.org],
    );
    if (!rows[0]) throw notFound('Cotação não encontrada');
    const { rows: offers } = await query(
      `SELECT o.id, o.status, o.payment_terms, o.delivery_days, o.freight_amount,
              o.total_amount, o.is_selected, o.responded_at,
              s.legal_name AS supplier_name, s.rating_avg
         FROM quotation_offers o JOIN suppliers s ON s.id = o.supplier_id
        WHERE o.quotation_id = $1 ORDER BY o.total_amount NULLS LAST`,
      [req.params.id],
    );
    res.json({ ...rows[0], offers });
  }),
);

const offerSchema = z.object({
  paymentTerms: z.string().max(120).optional(),
  deliveryDays: z.number().int().min(0).optional(),
  freightAmount: z.number().min(0).default(0),
  items: z
    .array(
      z.object({
        requestItemId: z.string().uuid(),
        unitPrice: z.number().min(0),
        quantity: z.number().positive(),
      }),
    )
    .min(1),
});

// Registrar proposta de um fornecedor
quotationsRouter.put(
  '/offers/:offerId',
  authorize('comprador', 'gestor', 'admin'),
  validate(offerSchema),
  asyncHandler(async (req, res) => {
    const b = req.body as z.infer<typeof offerSchema>;
    const total =
      b.items.reduce((acc, it) => acc + it.unitPrice * it.quantity, 0) + b.freightAmount;
    const result = await withTransaction(auditContext(req), async (client) => {
      const { rows } = await client.query(
        `UPDATE quotation_offers
            SET payment_terms = $1, delivery_days = $2, freight_amount = $3,
                total_amount = $4, status = 'respondida', responded_at = now()
          WHERE id = $5 RETURNING id, quotation_id`,
        [b.paymentTerms ?? null, b.deliveryDays ?? null, b.freightAmount, total, req.params.offerId],
      );
      if (!rows[0]) throw notFound('Proposta não encontrada');
      await client.query(`DELETE FROM quotation_offer_items WHERE offer_id = $1`, [req.params.offerId]);
      for (const it of b.items) {
        await client.query(
          `INSERT INTO quotation_offer_items (offer_id, request_item_id, unit_price, quantity)
           VALUES ($1,$2,$3,$4)`,
          [req.params.offerId, it.requestItemId, it.unitPrice, it.quantity],
        );
      }
      return { id: rows[0].id, totalAmount: total };
    });
    res.json(result);
  }),
);

// Selecionar proposta vencedora
quotationsRouter.post(
  '/:id/select/:offerId',
  authorize('comprador', 'gestor', 'admin'),
  asyncHandler(async (req, res) => {
    await withTransaction(auditContext(req), async (client) => {
      const { rowCount } = await client.query(
        `UPDATE quotation_offers SET is_selected = (id = $1),
                status = CASE WHEN id = $1 THEN 'selecionada'::quotation_status
                              WHEN status = 'respondida' THEN 'descartada'::quotation_status
                              ELSE status END
          WHERE quotation_id = $2`,
        [req.params.offerId, req.params.id],
      );
      if (!rowCount) throw notFound('Cotação/proposta não encontrada');
      await client.query(`UPDATE quotations SET status = 'concluida' WHERE id = $1`, [req.params.id]);
    });
    res.json({ quotationId: req.params.id, selectedOfferId: req.params.offerId });
  }),
);
