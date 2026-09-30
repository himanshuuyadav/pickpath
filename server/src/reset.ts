import { withTransaction } from './db.js';

export async function resetWarehouse() {
  await withTransaction(async (client) => {
    await client.query('truncate tasks, orders restart identity');
    await client.query('update stock set on_hand = 50, reserved = 0');
  });
}
