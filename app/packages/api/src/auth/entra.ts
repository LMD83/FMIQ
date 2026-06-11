import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { config } from '../config.js';
import type { AuthContext, Role } from '../types.js';

/**
 * Azure Entra ID JWT validation.
 *
 * Production: validates the bearer token against Entra's JWKS, checks audience,
 * and maps the `roles` claim (App Roles) to FMIQ roles. Tenant is taken from the
 * token's `tid` claim (the Entra tenant the user signed in from). In a real
 * deployment we map `tid` → our internal core_tenant via an allow-list; here we
 * use it directly for clarity.
 *
 * Dev (DEV_NO_AUTH=true): injects a dev tenant + ConservationOfficer role so the
 * collection-care engine can be exercised without a live Entra tenant.
 */

const jwks = createRemoteJWKSet(
  new URL(`https://login.microsoftonline.com/${config.entra.tenantId}/discovery/v2.0/keys`),
);

const ROLE_SET = new Set<Role>([
  'SystemAdmin', 'TenantAdmin', 'FacilitiesManager', 'ConservationOfficer', 'MaintenanceTech', 'ReadOnly',
]);

function mapRoles(payload: JWTPayload): Role[] {
  const raw = payload['roles'];
  const arr = Array.isArray(raw) ? raw : [];
  const mapped = arr.filter((r): r is Role => typeof r === 'string' && ROLE_SET.has(r as Role));
  return mapped.length ? mapped : ['ReadOnly'];
}

export async function authenticate(req: FastifyRequest, reply: FastifyReply): Promise<void> {
  if (config.devNoAuth) {
    req.auth = {
      tenantId: config.devTenantId,
      userId: config.devUserId,
      email: 'dev@museum.ie',
      roles: ['ConservationOfficer', 'FacilitiesManager'],
    };
    return;
  }

  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    await reply.code(401).send({ error: 'missing_bearer_token' });
    return;
  }

  try {
    const { payload } = await jwtVerify(header.slice(7), jwks, {
      audience: config.entra.audience,
      // Entra v2 issuers look like https://login.microsoftonline.com/{tid}/v2.0
      issuer: undefined,
    });
    if (!String(payload.iss ?? '').startsWith('https://login.microsoftonline.com/')) {
      await reply.code(401).send({ error: 'invalid_issuer' });
      return;
    }
    const tid = String(payload['tid'] ?? '');
    const oid = String(payload['oid'] ?? payload.sub ?? '');
    if (!tid || !oid) {
      await reply.code(401).send({ error: 'invalid_token_claims' });
      return;
    }
    const ctx: AuthContext = {
      tenantId: tid,
      userId: oid,
      email: typeof payload['preferred_username'] === 'string' ? payload['preferred_username'] : undefined,
      roles: mapRoles(payload),
    };
    req.auth = ctx;
  } catch {
    await reply.code(401).send({ error: 'token_verification_failed' });
  }
}
