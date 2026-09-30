import { randomUUID } from 'node:crypto';
import { database } from './db.js';
import { reserveOrder } from './orders.js';

const lineCount = () => { const roll = Math.random(); return roll < .5 ? 1 : roll < .8 ? 2 : roll < .95 ? 3 : 4; };

export async function generateOrder(rate: number) {
  if (Math.random() > Math.min(1, rate)) return null;
  const stocks = await database.query<{ sku: string }>("select sku from stock where sku <> 'RACE-001' order by sku limit 40");
  if (!stocks.rowCount) return null;
  const items = Array.from({ length: lineCount() }, (_, index) => ({ sku: stocks.rows[(index * 7 + Math.floor(Math.random() * 8)) % stocks.rows.length].sku, qty: 1 + Math.floor(Math.random() * 3) }));
  return reserveOrder({ items, priority: Math.random() < .05 ? 2 : Math.random() < .2 ? 1 : 0 }, `generated-${randomUUID()}`);
}

export async function replenishStock() {
  await database.query("update stock set on_hand = 50 where sku <> 'RACE-001' and on_hand - reserved < 10");
}
