import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

const app = Fastify({ logger: true });
await app.register(cors, { origin: process.env.CORS_ORIGIN ?? true });
await app.register(websocket);
app.get('/health', async () => ({ ok: true }));
app.get('/ws', { websocket: true }, (socket) => {
  socket.send(JSON.stringify({ type: 'snapshot', robots: [], connected: true }));
});
await app.listen({ port: Number(process.env.PORT ?? 3001), host: '0.0.0.0' });
