import { describe, expect, it } from 'vitest';
import { hashPassword, signToken, verifyPassword, verifyToken } from '../src/utils/security.js';

describe('security utils', () => {
  it('hash e verificação de senha', async () => {
    const hash = await hashPassword('segredo123');
    expect(await verifyPassword('segredo123', hash)).toBe(true);
    expect(await verifyPassword('errado', hash)).toBe(false);
  });

  it('emite e valida JWT', () => {
    const token = signToken({ sub: 'u1', org: 'o1', role: 'admin', name: 'Ana' });
    const payload = verifyToken(token);
    expect(payload.sub).toBe('u1');
    expect(payload.role).toBe('admin');
  });
});
