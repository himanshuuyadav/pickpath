# Warehouse Fulfillment Simulator

Local development uses Docker Postgres and a Fastify server. Supabase or Neon can be used by setting `DATABASE_URL`.

```text
npm install
npm run dev
```

## Load tests

Run with `ENABLE_DEV_ROUTES=true` and k6 installed. Results are intentionally left blank until measured against the target environment.

| Test | Pass condition | Result |
| --- | --- | --- |
| `oversell.js` | 1 accepted, 999 rejected, 0 oversold | Not measured |
| `idempotency.js` | 1 created, 99 replays | Not measured |
| `throughput.js` | Record p50/p95/p99 and error rate | Not measured |