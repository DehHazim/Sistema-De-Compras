import { Router } from 'express';
import { query } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler } from '../../utils/http.js';

export const dashboardRouter = Router();
dashboardRouter.use(authenticate);

dashboardRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const org = req.user!.org;

    const [kpis, spendByDept, topSuppliers, savings, monthly, pipeline] = await Promise.all([
      query(
        `SELECT
           (SELECT count(*)::int FROM purchase_requests WHERE organization_id = $1 AND status = 'em_aprovacao') AS pending_approvals,
           (SELECT count(*)::int FROM purchase_requests WHERE organization_id = $1 AND status NOT IN ('concluida','cancelada','reprovada')) AS open_requests,
           (SELECT count(*)::int FROM purchase_orders WHERE organization_id = $1 AND status NOT IN ('recebido','faturado','cancelado')) AS open_orders,
           (SELECT COALESCE(sum(total_amount),0) FROM purchase_orders WHERE organization_id = $1 AND status <> 'cancelado' AND issued_at >= date_trunc('year', now())) AS ytd_spend,
           (SELECT count(*)::int FROM suppliers WHERE organization_id = $1 AND status = 'ativo' AND deleted_at IS NULL) AS active_suppliers`,
        [org],
      ),
      query(
        `SELECT department_name, sum(total_spent)::numeric AS total_spent, sum(orders_count)::int AS orders_count
           FROM vw_spend_by_department
          WHERE organization_id = $1 AND month >= date_trunc('year', now())
          GROUP BY department_name ORDER BY total_spent DESC`,
        [org],
      ),
      query(
        `SELECT legal_name, total_spent, orders_count, rating_avg
           FROM vw_top_suppliers WHERE organization_id = $1
          ORDER BY total_spent DESC LIMIT 5`,
        [org],
      ),
      query(
        `SELECT COALESCE(sum(savings),0)::numeric AS total_savings FROM vw_savings WHERE organization_id = $1`,
        [org],
      ),
      query(
        `SELECT to_char(month,'YYYY-MM') AS month, sum(total_spent)::numeric AS total_spent
           FROM vw_spend_by_department
          WHERE organization_id = $1 AND month >= (now() - interval '11 months')
          GROUP BY month ORDER BY month`,
        [org],
      ),
      query(
        `SELECT status, count(*)::int AS count FROM purchase_requests
          WHERE organization_id = $1 AND deleted_at IS NULL GROUP BY status`,
        [org],
      ),
    ]);

    res.json({
      kpis: kpis.rows[0],
      spendByDepartment: spendByDept.rows,
      topSuppliers: topSuppliers.rows,
      totalSavings: savings.rows[0].total_savings,
      monthlySpend: monthly.rows,
      requestPipeline: pipeline.rows,
    });
  }),
);
