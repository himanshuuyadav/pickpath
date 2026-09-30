import { database, withTransaction } from './db.js';
import { reserveOrder } from './orders.js';

export async function stockRace(requests = 1000) {
  const open = await database.query("select 1 from orders o join tasks t on t.order_id = o.id where t.sku = 'RACE-001' and t.status <> 'DONE' limit 1");
  if (open.rowCount) throw Object.assign(new Error('Race order is still open'), { code: 'RACE_IN_PROGRESS' });
  await withTransaction(async (client) => {
    await client.query("update stock set on_hand = 1, reserved = 0 where sku = 'RACE-001'");
  });
  const results = await Promise.all(Array.from({ length: requests }, (_, index) => reserveOrder({ items: [{ sku: 'RACE-001', qty: 1 }] }, `race-${Date.now()}-${index}`)
    .then(() => true).catch(() => false)));
  const accepted = results.filter(Boolean).length;
  return { requests, accepted, rejected: requests - accepted, oversold: Math.max(0, accepted - 1) };
}