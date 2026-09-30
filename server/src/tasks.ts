import { withTransaction } from './db.js';

export async function completeTask(taskId: number) {
  return withTransaction(async (client) => {
    const task = await client.query<{ order_id: number; sku: string; qty: number }>('update tasks set status = $1, done_at = now() where id = $2 and status <> $1 returning order_id,sku,qty', ['DONE', taskId]);
    if (!task.rowCount) return null;
    const row = task.rows[0];
    await client.query('update stock set on_hand = on_hand - $1, reserved = reserved - $1 where sku = $2', [row.qty, row.sku]);
    const open = await client.query('select 1 from tasks where order_id = $1 and status <> $2 limit 1', [row.order_id, 'DONE']);
    if (!open.rowCount) await client.query('update orders set status = $1, packed_at = now() where id = $2', ['PACKED', row.order_id]);
    return row;
  });
}

export async function recoverTasks() {
  return withTransaction(async (client) => {
    await client.query("update tasks set status = 'PENDING', robot_id = null where status in ('ASSIGNED','PICKED')");
    await client.query("update orders set status = 'DISPATCHED', dispatched_at = now() where status = 'PACKED'");
  });
}
