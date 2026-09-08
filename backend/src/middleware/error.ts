import type { NextFunction, Request, Response } from 'express';
import pg from 'pg';
import { HttpError } from '../utils/http.js';
import { logger } from '../config/logger.js';

export function notFoundHandler(_req: Request, res: Response) {
  res.status(404).json({ error: 'Rota não encontrada' });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, details: err.details });
  }

  // Violações conhecidas do Postgres
  if (err instanceof pg.DatabaseError) {
    if (err.code === '23505') return res.status(409).json({ error: 'Registro duplicado' });
    if (err.code === '23503') return res.status(409).json({ error: 'Violação de referência' });
    if (err.code === '23514') return res.status(422).json({ error: 'Violação de regra de negócio (check)' });
  }

  logger.error({ err }, 'Erro não tratado');
  res.status(500).json({ error: 'Erro interno' });
}
