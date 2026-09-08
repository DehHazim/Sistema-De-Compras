import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { env } from './config/env.js';
import { logger } from './config/logger.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { requestsRouter } from './modules/requests/requests.routes.js';
import { approvalsRouter } from './modules/approvals/approvals.routes.js';
import { suppliersRouter } from './modules/suppliers/suppliers.routes.js';
import { quotationsRouter } from './modules/quotations/quotations.routes.js';
import { purchaseOrdersRouter } from './modules/purchase-orders/purchaseOrders.routes.js';
import { budgetRouter } from './modules/budget/budget.routes.js';
import { dashboardRouter } from './modules/dashboard/dashboard.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { notificationsRouter } from './modules/notifications/notifications.routes.js';
import { catalogRouter } from './modules/catalog/catalog.routes.js';
import { reportsRouter } from './modules/reports/reports.routes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(cors({ origin: env.CORS_ORIGIN.split(',') }));
  app.use(express.json({ limit: '1mb' }));
  app.use(pinoHttp({ logger }));
  app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60_000, limit: 20 }));

  app.get('/health', (_req, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

  app.use('/api/auth', authRouter);
  app.use('/api/requests', requestsRouter);
  app.use('/api/approvals', approvalsRouter);
  app.use('/api/suppliers', suppliersRouter);
  app.use('/api/quotations', quotationsRouter);
  app.use('/api/purchase-orders', purchaseOrdersRouter);
  app.use('/api/budget', budgetRouter);
  app.use('/api/dashboard', dashboardRouter);
  app.use('/api/audit-logs', auditRouter);
  app.use('/api/notifications', notificationsRouter);
  app.use('/api/catalog', catalogRouter);
  app.use('/api/reports', reportsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
