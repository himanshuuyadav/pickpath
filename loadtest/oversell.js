import http from 'k6/http';
import { check } from 'k6';

export const options = { scenarios: { race: { executor: 'shared-iterations', vus: 1000, iterations: 1000, maxDuration: '2m' } } };
const base = __ENV.BASE_URL || 'http://localhost:3001';
export function setup() { http.post(`${base}/api/dev/set-stock`, JSON.stringify({ sku: 'RACE-001', onHand: 1 }), { headers: { 'Content-Type': 'application/json' } }); }
export default function () {
  const response = http.post(`${base}/api/orders`, JSON.stringify({ items: [{ sku: 'RACE-001', qty: 1 }] }), { headers: { 'Content-Type': 'application/json', 'Idempotency-Key': `race-${__VU}-${__ITER}` } });
  check(response, { 'accepted or rejected': (result) => result.status === 201 || result.status === 409 });
}
