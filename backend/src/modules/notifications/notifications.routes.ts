import { Router } from 'express';
import { query } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { asyncHandler, paginate } from '../../utils/http.js';

export const notificationsRouter = Router();
notificationsRouter.use(authenticate);

notificationsRouter.get(
  '/',
  asyncHandler(async (req, res) => {
    const { limit, offset } = paginate(req.query);
    const onlyUnread = req.query.unread === 'true';
    const { rows } = await query(
      `SELECT id, event_type, title, body, link, read_at, created_at
         FROM notifications
        WHERE user_id = $1 ${onlyUnread ? 'AND read_at IS NULL' : ''}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}`,
      [req.user!.sub],
    );
    const { rows: unread } = await query(
      `SELECT count(*)::int AS count FROM notifications WHERE user_id = $1 AND read_at IS NULL`,
      [req.user!.sub],
    );
    res.json({ data: rows, unreadCount: unread[0].count });
  }),
);

notificationsRouter.post(
  '/:id/read',
  asyncHandler(async (req, res) => {
    await query(
      `UPDATE notifications SET read_at = now() WHERE id = $1 AND user_id = $2 AND read_at IS NULL`,
      [req.params.id, req.user!.sub],
    );
    res.json({ id: req.params.id, read: true });
  }),
);

notificationsRouter.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    await query(
      `UPDATE notifications SET read_at = now() WHERE user_id = $1 AND read_at IS NULL`,
      [req.user!.sub],
    );
    res.json({ ok: true });
  }),
);
