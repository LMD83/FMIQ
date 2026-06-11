import 'dotenv/config';

export const config = {
  port: Number(process.env.PORT ?? 8080),
  databaseUrl: process.env.DATABASE_URL ?? 'postgresql://fmiq_app:fmiq_app@localhost:5432/fmiq',
  devNoAuth: (process.env.DEV_NO_AUTH ?? 'true') === 'true',
  devTenantId: process.env.DEV_TENANT_ID ?? '00000000-0000-0000-0000-0000000000a1',
  devUserId: process.env.DEV_USER_ID ?? '00000000-0000-0000-0000-0000000000b1',
  entra: {
    tenantId: process.env.ENTRA_TENANT_ID ?? 'common',
    audience: process.env.ENTRA_API_AUDIENCE ?? 'api://fmiq-api',
  },
  // Outbox relay: run the poller in-process with the API (handy in dev). Disable
  // (OUTBOX_RELAY=false) where a standalone worker process owns the outbox.
  outboxRelayEnabled: (process.env.OUTBOX_RELAY ?? 'true') === 'true',
  outboxRelayIntervalMs: Number(process.env.OUTBOX_RELAY_INTERVAL_MS ?? 2000),
  // Outbound integrations — endpoints + secrets come from env/Key Vault. When unset the
  // adapters fall back to their null/deferred behaviour (so dev/test never call out).
  erp: {
    target: (process.env.ERP_TARGET ?? 'none') as 'none' | 'agresso' | 'sap',
    endpoint: process.env.ERP_ENDPOINT,
    secret: process.env.ERP_SECRET,
  },
  revenueTcvEndpoint: process.env.REVENUE_TCV_ENDPOINT,
  metEireannEndpoint: process.env.MET_EIREANN_ENDPOINT,
} as const;
