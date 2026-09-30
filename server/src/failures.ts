import { withTransaction } from './db.js';

export async function requeueRobotTask(robotId: number) {
  return withTransaction(async (client) => {
    const task = await client.query<{ id: number }>("update tasks set status = 'PENDING', robot_id = null where robot_id = $1 and status in ('ASSIGNED','PICKED') returning id", [robotId]);
    return task.rows[0]?.id ?? null;
  });
}
