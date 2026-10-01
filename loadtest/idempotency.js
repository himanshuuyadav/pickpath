import http from 'k6/http';
import { check } from 'k6';

export const options = { scenarios: { replay: { executor: 'shared-iterations', vus: 100, iterations: 100, maxDuration: '1m' } } };
const base = __ENV.BASE_URL || 'http://localhost:3001';
export default function () {
  const response = http.post(`${base}/api/orders`, JSON.stringify({ items: [{ sku: 'SKU-001', qty: 1 }] }), { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': 'same-load-test-key' } });
  check(response, { 'created or replayed': (result) => result.status === 201 || result.status === 200 });
}
