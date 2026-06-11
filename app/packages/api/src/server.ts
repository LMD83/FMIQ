import Fastify from 'fastify';
import cors from '@fastify/cors';
import { config } from './config.js';
import { authenticate } from './auth/entra.js';
import { zoneRoutes } from './routes/zones.js';
import { workOrderRoutes } from './routes/workOrders.js';
import { ingestRoutes } from './routes/ingest.js';
import { adapterRoutes } from './routes/adapters.js';
import { readingRoutes } from './routes/readings.js';
import { portfolioRoutes } from './routes/portfolio.js';
import { assetRoutes } from './routes/assets.js';
import { dashboardRoutes } from './routes/dashboards.js';
import { ppmRoutes } from './routes/ppm.js';
import { complianceCertRoutes } from './routes/compliance.js';
import { inventoryRoutes } from './routes/inventory.js';
import { approvalRoutes } from './routes/approvals.js';
import { ssowRoutes } from './routes/ssow.js';
import { calendarRoutes } from './routes/calendar.js';
import { notificationRoutes } from './routes/notifications.js';
import { integrationRoutes } from './routes/integrations.js';
import { erpRoutes } from './routes/erp.js';
import { handoverRoutes } from './routes/handover.js';
import { softServiceRoutes } from './routes/softServices.js';
import { lifecycleRoutes } from './routes/lifecycle.js';
import { sustainabilityRoutes } from './routes/sustainability.js';
import { preconditioningRoutes } from './routes/preconditioning.js';
import { intelligenceRoutes } from './routes/intelligence.js';
import { helpdeskRoutes } from './routes/helpdesk.js';
import { documentRoutes } from './routes/documents.js';
import { evidenceRoutes } from './routes/evidence.js';
import { issueRoutes } from './routes/issues.js';
import { importRoutes } from './routes/imports.js';
import { startOutboxRelay } from './workers/outboxRelay.js';
import './types.js';

async function main(): Promise<void> {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });

  app.get('/health', async () => ({ status: 'ok', service: 'fmiq-api', region: 'northeurope' }));

  app.addHook('onRequest', async (req, reply) => {
    if (req.url.startsWith('/api/')) {
      await authenticate(req, reply);
    }
  });

  await app.register(zoneRoutes);
  await app.register(workOrderRoutes);
  await app.register(ingestRoutes);
  await app.register(adapterRoutes);
  await app.register(readingRoutes);
  await app.register(portfolioRoutes);
  await app.register(assetRoutes);
  await app.register(dashboardRoutes);
  await app.register(ppmRoutes);
  await app.register(complianceCertRoutes);
  await app.register(inventoryRoutes);
  await app.register(approvalRoutes);
  await app.register(ssowRoutes);
  await app.register(calendarRoutes);
  await app.register(notificationRoutes);
  await app.register(integrationRoutes);
  await app.register(erpRoutes);
  await app.register(handoverRoutes);
  await app.register(softServiceRoutes);
  await app.register(lifecycleRoutes);
  await app.register(sustainabilityRoutes);
  await app.register(preconditioningRoutes);
  await app.register(intelligenceRoutes);
  await app.register(helpdeskRoutes);
  await app.register(documentRoutes);
  await app.register(evidenceRoutes);
  await app.register(issueRoutes);
  await app.register(importRoutes);

  if (config.outboxRelayEnabled) {
    const stopRelay = startOutboxRelay({ intervalMs: config.outboxRelayIntervalMs });
    app.addHook('onClose', async () => stopRelay());
    app.log.info(`Outbox relay started (interval ${config.outboxRelayIntervalMs}ms)`);
  }

  await app.listen({ port: config.port, host: '0.0.0.0' });
  app.log.info(`FMIQ API listening on :${config.port} (auth: ${config.devNoAuth ? 'DEV bypass' : 'Entra ID'})`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
