export type Role =
  | 'SystemAdmin'
  | 'TenantAdmin'
  | 'FacilitiesManager'
  | 'ConservationOfficer'
  | 'MaintenanceTech'
  | 'ReadOnly';

export interface AuthContext {
  tenantId: string;
  userId: string;
  email?: string;
  roles: Role[];
}

declare module 'fastify' {
  interface FastifyRequest {
    auth: AuthContext;
  }
}
