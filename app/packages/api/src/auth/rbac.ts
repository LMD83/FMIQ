import type { FastifyReply, FastifyRequest } from 'fastify';
import type { Role } from '../types.js';

/** Fastify preHandler factory: require at least one of the given roles. */
export function requireRole(...allowed: Role[]) {
  return async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const has = req.auth?.roles?.some((r) => allowed.includes(r));
    if (!has) {
      await reply.code(403).send({ error: 'forbidden', required: allowed });
    }
  };
}
