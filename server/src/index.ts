import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { simConfig, simMetrics, snapshot, tick, views, TICK_MS } from './sim.js';

const app = Fastify({ logger: true });
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
app.post('/api/sim/config', async (request) => simConfig(request.body as Partial<{ robots: number; orderRate: number; running: boolean }>));
setInterval(() => { tick(); const data = JSON.stringify({ type: 'tick', t: Date.now(), robots: views() }); clients.forEach((client) => { if (client.readyState === 1) client.send(data); }); }, TICK_MS);
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' });
