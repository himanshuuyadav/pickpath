import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { killRobot, resetSim, simConfig, simMetrics, snapshot, tick, views, TICK_MS } from './sim.js';
import { migrate } from './migrate.js';
import { reserveOrder, validateOrder, type OrderInput } from './orders.js';
import { recoverTasks } from './tasks.js';
import { resetWarehouse } from './reset.js';

const app = Fastify({ logger: true });
await migrate();
await recoverTasks();
await app.register(cors, { origin: process.env.CORS_ORIGIN ?? true });
await app.register(websocket);
app.get('/health', async () => ({ ok: true }));
const clients = new Set<{ send(data: string): void; readyState: number }>();
app.get('/ws', { websocket: true }, (socket) => {
  clients.add(socket);
  socket.send(JSON.stringify({ type: 'snapshot', ...snapshot() }));
  socket.on('close', () => clients.delete(socket));
});
app.get('/api/state', async () => snapshot());
app.get('/api/metrics', async () => simMetrics());
app.post('/api/orders', async (request, reply) => {
  const key = request.headers['idempotency-key'];
  const body = request.body as OrderInput;
  if (!key || typeof key !== 'string') return reply.code(400).send({ error: { code: 'MISSING_IDEMPOTENCY_KEY', message: 'Provide an Idempotency-Key header.' } });
  if (!validateOrder(body)) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Use 1–10 items with quantities from 1 to 10.' } });
  try { const result = await reserveOrder(body, key); return reply.code(result.replay ? 200 : 201).send(result.order); }
  catch (error) {
    const cause = error as { code?: string; sku?: string };
    const status = cause.code === 'UNKNOWN_SKU' ? 404 : 409;
    return reply.code(status).send({ error: { code: cause.code ?? 'ORDER_FAILED', message: cause.code === 'UNKNOWN_SKU' ? 'The requested SKU does not exist.' : 'Stock could not be reserved.', sku: cause.sku } });
  }
});
app.post('/api/sim/config', async (request) => simConfig(request.body as Partial<{ robots: number; orderRate: number; running: boolean }>));
app.post('/api/sim/reset', async () => { await resetWarehouse(); simConfig({ running: false }); resetSim(); return snapshot(); });
app.post('/api/sim/robots/:id/kill', async (request, reply) => {
  const killed = await killRobot(Number((request.params as { id: string }).id));
  return killed ? { ok: true } : reply.code(404).send({ error: { code: 'ROBOT_NOT_FOUND', message: 'No live robot has that id.' } });
});
setInterval(async () => { await tick(); const data = JSON.stringify({ type: 'tick', t: Date.now(), robots: views() }); clients.forEach((client) => { if (client.readyState === 1) client.send(data); }); }, TICK_MS);
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' });
