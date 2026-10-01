import http from 'k6/http';
import { check } from 'k6';

export const options = { stages: [{ duration: '30s', target: 100 }, { duration: '30s', target: 500 }, { duration: '30s', target: 1000 }, { duration: '10s', target: 0 }] };
const base = __ENV.BASE_URL || 'http://localhost:3001';
export default function () {
  const sku = `SKU-${String(1 + (__VU % 40)).padStart(3, '0')}`;
  const response = http.post(`${base}/api/orders`, JSON.stringify({ items: [{ sku, qty: 1 }] }), { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `throughput-${__VU}-${__ITER}` } });
  check(response, { 'request handled': (result) => result.status === 201 || result.status === 409 });
}
