import { Router } from 'express';
import { query } from '../../db/pool.js';
import { authenticate, authorize } from '../../middleware/auth.js';
import { asyncHandler, paginate } from '../../utils/http.js';

export const auditRouter = Router();
auditRouter.use(authenticate, authorize('gestor', 'admin'));

auditRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset, page, pageSize } = paginate(req.query);
    const { entity, entityId, actorId, action } = req.query as Record<string, string>;
    const params: unknown[] = [req.user!.org];
    let where = 'a.organization_id = $1';
    for (const [k, v] of Object.entries({ entity, entity_id: entityId, actor_id: actorId, action })) {
      if (v) {
        params.push(v);
        where += ` AND a.${k} = $${params.length}`;
      }
    }
    const { rows } = await query(
      `SELECT a.id, a.action, a.entity, a.entity_id, a.changed_fields, a.ip_address,
              a.created_at, u.full_name AS actor_name
         FROM audit_logs a LEFT JOIN users u ON u.id = a.actor_id
        WHERE ${where}
        ORDER BY a.created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      params,
    );
    res.json({ data: rows, page, pageSize });
  }),
);

auditRouter.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT a.*, u.full_name AS actor_name FROM audit_logs a
         LEFT JOIN users u ON u.id = a.actor_id
        WHERE a.id = $1 AND a.organization_id = $2`,
      [req.params.id, req.user!.org],
    );
    res.json(rows[0] ?? null);
  }),
);
