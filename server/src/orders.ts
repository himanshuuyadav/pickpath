import { withTransaction } from './db.js';

export type OrderInput = { items: { sku: string; qty: number }[]; priority?: number };

export async function reserveOrder(input: OrderInput, idempotencyKey: string) {
  const items = [...input.items.reduce((merged, item) => merged.set(item.sku, (merged.get(item.sku) ?? 0) + item.qty), new Map<string, number>())]
    .map(([sku, qty]) => ({ sku, qty })).sort((a, b) => a.sku.localeCompare(b.sku));
  return withTransaction(async (client) => {
    const created = await client.query<{ id: number }>('insert into orders (idempotency_key,status,priority) values ($1, $2, $3) on conflict (idempotency_key) do nothing returning id', [idempotencyKey, 'RESERVED', input.priority ?? 0]);
    if (!created.rowCount) { const existing = await client.query('select id,status from orders where idempotency_key = $1', [idempotencyKey]); return { replay: true, order: existing.rows[0] }; }
    const orderId = created.rows[0].id;
    for (const item of items) {
      const stock = await client.query('update stock set reserved = reserved + $1 where sku = $2 and on_hand - reserved >= $1 returning sku', [item.qty, item.sku]);
      if (!stock.rowCount) throw Object.assign(new Error('Insufficient stock'), { code: 'INSUFFICIENT_STOCK', sku: item.sku });
      await client.query('insert into tasks (order_id,sku,qty,priority,status) values ($1,$2,$3,$4,$5)', [orderId, item.sku, item.qty, input.priority ?? 0, 'PENDING']);
    }
    return { replay: false, order: { id: orderId, status: 'RESERVED' } };
  });
}
