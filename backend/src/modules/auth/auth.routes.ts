import { Router } from 'express';
import { z } from 'zod';
import { query } from '../../db/pool.js';
import { authenticate } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler, unauthorized } from '../../utils/http.js';
import { signToken, verifyPassword } from '../../utils/security.js';

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

authRouter.post(
  '/login',
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body as z.infer<typeof loginSchema>;
    const { rows } = await query(
      `SELECT id, organization_id, full_name, email, password_hash, role, is_active
         FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email],
    );
    const user = rows[0];
    if (!user || !user.is_active || !(await verifyPassword(password, user.password_hash))) {
      throw unauthorized('Credenciais inválidas');
    }
    await query('UPDATE users SET last_login_at = now() WHERE id = $1', [user.id]);

    const token = signToken({
      sub: user.id,
      org: user.organization_id,
      role: user.role,
      name: user.full_name,
    });
    res.json({
      token,
      user: {
        id: user.id,
        name: user.full_name,
        email: user.email,
        role: user.role,
        organizationId: user.organization_id,
      },
    });
  }),
);

authRouter.get(
  '/me',
  authenticate,
  asyncHandler(async (req, res) => {
    const { rows } = await query(
      `SELECT u.id, u.full_name, u.email, u.role, u.approval_limit,
              u.organization_id, d.name AS department
         FROM users u LEFT JOIN departments d ON d.id = u.department_id
        WHERE u.id = $1`,
      [req.user!.sub],
    );
    if (!rows[0]) throw unauthorized();
    res.json(rows[0]);
  }),
);
