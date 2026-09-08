import { Router } from 'express';
import { query } from '../../db/pool.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/http.js';

export const reportsRouter = Router();
reportsRouter.use(authenticate, authorize('comprador', 'gestor', 'admin'));

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const escape = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((r) => headers.map((h) => escape(r[h])).join(','))].join('\n');
}

const REPORTS: Record<string, string> = {
  'compras-por-fornecedor': `
    SELECT legal_name AS fornecedor, orders_count AS pedidos, total_spent AS valor_total, rating_avg AS nota
      FROM vw_top_suppliers WHERE organization_id = $1 ORDER BY total_spent DESC`,
  'gastos-por-setor': `
    SELECT department_name AS setor, to_char(month,'YYYY-MM') AS mes,
           orders_count AS pedidos, total_spent AS valor
      FROM vw_spend_by_department WHERE organization_id = $1 ORDER BY month, department_name`,
  'economia-negociada': `
    SELECT request_id AS solicitacao, best_rejected AS melhor_recusada,
           selected_total AS selecionada, savings AS economia
      FROM vw_savings WHERE organization_id = $1 ORDER BY savings DESC`,
  'execucao-orcamentaria': `
    SELECT cc.code AS centro_custo, vb.fiscal_year AS ano, vb.amount_planned AS planejado,
           vb.amount_committed AS comprometido, vb.amount_executed AS realizado, vb.amount_available AS disponivel
      FROM vw_budget_balance vb JOIN cost_centers cc ON cc.id = vb.cost_center_id
     WHERE cc.organization_id = $1 ORDER BY cc.code`,
};

reportsRouter.get(
  '/:name',
  asyncHandler(async (req, res) => {
    const sql = REPORTS[req.params.name];
    if (!sql) return res.status(404).json({ error: 'Relatório inexistente', available: Object.keys(REPORTS) });
    const { rows } = await query(sql, [req.user!.org]);

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${req.params.name}.csv"`);
      return res.send(toCsv(rows));
    }
    res.json({ report: req.params.name, generatedAt: new Date().toISOString(), rows });
  }),
);
