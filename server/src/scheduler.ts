import { buildLayout, findPath, type Point } from '@warehouse/shared';
import { database } from './db.js';

export type AvailableRobot = { id: number; position: Point };
export type Assignment = { taskId: number; robotId: number; shelf: Point; access: Point; path: Point[] };

const layout = buildLayout();

export function chooseRobotForAccess(robots: AvailableRobot[], access: Point) {
  return robots.map((robot) => ({ robot, path: findPath(layout, robot.position, access) }))
    .filter((choice): choice is { robot: AvailableRobot; path: Point[] } => choice.path !== null)
    .sort((a, b) => a.path.length - b.path.length || a.robot.id - b.robot.id)[0] ?? null;
}

export async function schedule(robots: AvailableRobot[]): Promise<Assignment[]> {
  const pending = await database.query<{ id: number; shelf_x: number; shelf_y: number }>("select t.id, s.shelf_x, s.shelf_y from tasks t join stock s on s.sku = t.sku where t.status = 'PENDING' order by t.priority desc, t.created_at asc");
  const available = [...robots];
  const assignments: Assignment[] = [];
  for (const task of pending.rows) {
    const choices = available.map((robot) => {
      const shelf = { x: task.shelf_x, y: task.shelf_y };
      const access = shelf.x % 3 === 2 ? { x: shelf.x - 1, y: shelf.y } : { x: shelf.x + 1, y: shelf.y };
      const choice = chooseRobotForAccess([robot], access);
      return choice ? { ...choice, shelf, access } : null;
    }).filter((choice): choice is { robot: AvailableRobot; shelf: Point; access: Point; path: Point[] } => choice !== null)
      .sort((a, b) => a.path.length - b.path.length || a.robot.id - b.robot.id);
    const choice = choices[0];
    if (!choice) continue;
    const claimed = await database.query("update tasks set status = 'ASSIGNED', robot_id = $1 where id = $2 and status = 'PENDING' returning id", [choice.robot.id, task.id]);
    if (!claimed.rowCount) continue;
    await database.query("update orders set status = 'PICKING' where id = (select order_id from tasks where id = $1) and status = 'RESERVED'", [task.id]);
    assignments.push({ taskId: task.id, robotId: choice.robot.id, shelf: choice.shelf, access: choice.access, path: choice.path });
    available.splice(available.indexOf(choice.robot), 1);
  }
  return assignments;
}
