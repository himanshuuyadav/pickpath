import { withTransaction } from './db.js';

export type OrderInput = { items: { sku: string; qty: number }[]; priority?: number };

export function validateOrder(input: unknown): input is OrderInput {
  const value = input as OrderInput;
  return Array.isArray(value?.items) && value.items.length >= 1 && value.items.length <= 10
    && value.items.every((item) => typeof item.sku === 'string' && item.sku.length > 0 && Number.isInteger(item.qty) && item.qty >= 1 && item.qty <= 10)
    && (value.priority === undefined || [0, 1, 2].includes(value.priority));
}

export async function reserveOrder(input: OrderInput, idempotencyKey: string) {
  const items = [...input.items.reduce((merged, item) => merged.set(item.sku, (merged.get(item.sku) ?? 0) + item.qty), new Map<string, number>())]
    .map(([sku, qty]) => ({ sku, qty })).sort((a, b) => a.sku.localeCompare(b.sku));
  return withTransaction(async (client) => {
    const created = await client.query<{ id: number }>('insert into orders (idempotency_key,status,priority) values ($1, $2, $3) on conflict (idempotency_key) do nothing returning id', [idempotencyKey, 'RESERVED', input.priority ?? 0]);
    if (!created.rowCount) { const existing = await client.query('select id,status from orders where idempotency_key = $1', [idempotencyKey]); return { replay: true, order: existing.rows[0] }; }
    const orderId = created.rows[0].id;
    for (const item of items) {
      const stock = await client.query('update stock set reserved = reserved + $1 where sku = $2 and on_hand - reserved >= $1 returning sku', [item.qty, item.sku]);
      if (!stock.rowCount) {
        const known = await client.query('select 1 from stock where sku = $1', [item.sku]);
        throw Object.assign(new Error(known.rowCount ? 'Insufficient stock' : 'Unknown SKU'), { code: known.rowCount ? 'INSUFFICIENT_STOCK' : 'UNKNOWN_SKU', sku: item.sku });
      }
      await client.query('insert into tasks (order_id,sku,qty,priority,status) values ($1,$2,$3,$4,$5)', [orderId, item.sku, item.qty, input.priority ?? 0, 'PENDING']);
    }
    return { replay: false, order: { id: orderId, status: 'RESERVED' } };
  });
}
