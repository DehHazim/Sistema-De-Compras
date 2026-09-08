import type { NextFunction, Request, Response } from 'express';
import { forbidden, unauthorized } from '../utils/http.js';
import { verifyToken, type TokenPayload } from '../utils/security.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: TokenPayload;
    }
  }
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) throw unauthorized();
  try {
    req.user = verifyToken(header.slice(7));
    next();
  } catch {
    throw unauthorized('Token inválido ou expirado');
  }
}

/** Restringe a rota a um conjunto de papéis. */
export const authorize =
  (...roles: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) throw unauthorized();
    if (roles.length && !roles.includes(req.user.role)) throw forbidden();
    next();
  };

export const auditContext = (req: Request) => ({
  userId: req.user?.sub,
  ip: req.ip,
});
