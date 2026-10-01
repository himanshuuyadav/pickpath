import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { eventsAfter, killRobot, resetSim, simConfig, simMetrics, snapshot, tick, views, TICK_MS } from './sim.js';
import { migrate } from './migrate.js';
import { reserveOrder, validateOrder, type OrderInput } from './orders.js';
import { recoverTasks } from './tasks.js';
import { resetWarehouse } from './reset.js';
import { stockRace } from './demo.js';
import { database } from './db.js';

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
app.post('/api/sim/reset', async () => { await resetWarehouse(); simConfig({ running: false }); resetSim(); eventCursor = 0; return snapshot(); });
app.post('/api/sim/robots/:id/kill', async (request, reply) => {
  const killed = await killRobot(Number((request.params as { id: string }).id));
  return killed ? { ok: true } : reply.code(404).send({ error: { code: 'ROBOT_NOT_FOUND', message: 'No live robot has that id.' } });
});
app.post('/api/demo/stock-race', async (request, reply) => {
  const requests = Number((request.body as { requests?: number } | undefined)?.requests ?? 1000);
  if (!Number.isInteger(requests) || requests < 1 || requests > 1000) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Requests must be an integer from 1 to 1000.' } });
  try { return await stockRace(requests); }
  catch (error) { const cause = error as { code?: string }; return reply.code(cause.code === 'RACE_IN_PROGRESS' ? 409 : 500).send({ error: { code: cause.code ?? 'RACE_FAILED', message: 'The stock race could not run.' } }); }
});
app.post('/api/dev/set-stock', async (request, reply) => {
  if (process.env.ENABLE_DEV_ROUTES !== 'true') return reply.code(404).send({ error: { code: 'NOT_FOUND', message: 'Development routes are disabled.' } });
  const body = request.body as { sku?: string; onHand?: number };
  const onHand = body?.onHand;
  if (!body?.sku || typeof onHand !== 'number' || !Number.isInteger(onHand) || onHand < 0) return reply.code(400).send({ error: { code: 'VALIDATION_ERROR', message: 'Provide a SKU and non-negative integer onHand.' } });
  const result = await database.query('update stock set on_hand = greatest($1, reserved) where sku = $2 returning sku,on_hand,reserved', [onHand, body.sku]);
  if (!result.rowCount) return reply.code(404).send({ error: { code: 'UNKNOWN_SKU', message: 'The requested SKU does not exist.' } });
  return result.rows[0];
});
let metricTicks = 0;
let eventCursor = 0;
let tickRunning = false;
setInterval(async () => {
  if (tickRunning) return;
  tickRunning = true;
  try {
    await tick();
    const tickMessage = JSON.stringify({ type: 'tick', t: Date.now(), robots: views() });
    clients.forEach((client) => { if (client.readyState === 1) client.send(tickMessage); });
    const batch = eventsAfter(eventCursor); eventCursor = batch.cursor;
    batch.events.forEach((event) => { const eventMessage = JSON.stringify({ type: 'event', event }); clients.forEach((client) => { if (client.readyState === 1) client.send(eventMessage); }); });
    if (++metricTicks % 5 === 0) {
      const metricMessage = JSON.stringify({ type: 'metrics', metrics: simMetrics() });
      clients.forEach((client) => { if (client.readyState === 1) client.send(metricMessage); });
    }
  } finally {
    tickRunning = false;
  }
}, TICK_MS);
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' });
