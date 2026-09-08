import type { NextFunction, Request, Response } from 'express';
import { ZodError, type ZodSchema } from 'zod';
import { unprocessable } from '../utils/http.js';

type Source = 'body' | 'query' | 'params';

export const validate =
  (schema: ZodSchema, source: Source = 'body') =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      const parsed = schema.parse(req[source]);
      // query/params são read-only em alguns setups; reatribui com segurança
      Object.defineProperty(req, source, { value: parsed, writable: true });
      next();
    } catch (err) {
      if (err instanceof ZodError) {
        throw unprocessable('Dados inválidos', err.flatten().fieldErrors);
      }
      throw err;
    }
  };
