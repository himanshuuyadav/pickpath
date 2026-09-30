import { arbitrate, buildLayout, findPath, type Point, type RobotState, type RobotView, type SimConfig, type Metrics, type SimEvent } from '@warehouse/shared';
import { DROP_TICKS, PICK_TICKS, TICK_MS } from './constants.js';
import { schedule } from './scheduler.js';
import { generateOrder, replenishStock } from './generator.js';
import { completeTask } from './tasks.js';

type Robot = RobotView & { goal: Point | null; waitTicks: number; actionTicks: number };
const layout = buildLayout();
const metrics: Metrics = { ordersDispatched: 0, ordersRejected: 0, throughputPerHour: 0, latencyAvgMs: 0, latencyP95Ms: 0, robotUtilization: 0, backlog: 0, robotsActive: 0, maxWaitTicks: 0 };
const config: SimConfig = { robots: 12, orderRate: 0.5, running: false };
let robots: Robot[] = [];
let ticks = 0;
const events: SimEvent[] = [];

export function resetSim() { robots = Array.from({ length: config.robots }, (_, id) => ({ id: id + 1, x: id, y: 19, state: 'IDLE' as RobotState, taskId: null, path: [], goal: null, waitTicks: 0, actionTicks: 0 })); metrics.robotsActive = robots.length; }
resetSim();
export function snapshot() { return { layout, config, robots: views(), metrics, events: events.slice(-12) }; }
export function views() { return robots.map(({ id, x, y, state, taskId, path }) => ({ id, x, y, state, taskId, path })); }
export function simMetrics() { return metrics; }
export function simConfig(input?: Partial<SimConfig>) { if (input) { Object.assign(config, input); if (input.robots !== undefined) resetSim(); } return config; }
export async function tick() {
  ticks++;
  if (!config.running) return;
  if (ticks % 5 === 0) for (let index = 0; index < Math.floor(config.orderRate) + (Math.random() < config.orderRate % 1 ? 1 : 0); index++) await generateOrder(config.orderRate);
  if (ticks % 150 === 0) await replenishStock();
  const assignments = await schedule(robots.filter((robot) => robot.state === 'IDLE').map((robot) => ({ id: robot.id, position: robot })));
  for (const assignment of assignments) {
    const robot = robots.find((item) => item.id === assignment.robotId)!;
    robot.state = 'TO_SHELF'; robot.taskId = assignment.taskId; robot.goal = assignment.shelf;
    robot.path = assignment.path.map((point) => [point.x, point.y]);
  }
  const motion = arbitrate(robots.map((robot) => ({ id: robot.id, current: robot, next: robot.path[0] ? { x: robot.path[0][0], y: robot.path[0][1] } : null })), ticks);
  const canMove = new Set(motion.allowed);
  for (const robot of robots) {
    if (robot.state === 'PICKING' || robot.state === 'DROPPING') {
      robot.actionTicks--;
      if (robot.actionTicks > 0) continue;
      if (robot.state === 'PICKING') { robot.state = 'TO_STATION'; robot.goal = layout.stations[robot.id % layout.stations.length]; assignPath(robot); }
      else { if (robot.taskId) await completeTask(robot.taskId); robot.state = 'RETURNING'; robot.taskId = null; robot.goal = { x: robot.id - 1, y: 19 }; assignPath(robot); }
      continue;
    }
    if (robot.path.length && canMove.has(robot.id)) { const next = robot.path.shift()!; robot.x = next[0]; robot.y = next[1]; robot.waitTicks = 0; }
    else if (robot.path.length) { robot.waitTicks++; }
    if (!robot.path.length && robot.goal) {
      if (robot.state === 'TO_SHELF') { robot.state = 'PICKING'; robot.actionTicks = PICK_TICKS; }
      else if (robot.state === 'TO_STATION') { robot.state = 'DROPPING'; robot.actionTicks = DROP_TICKS; }
      else { robot.state = 'IDLE'; robot.goal = null; robot.taskId = null; }
    }
  }
  metrics.robotsActive = robots.length;
  metrics.robotUtilization = robots.filter((r) => r.state !== 'IDLE' && r.state !== 'FAILED').length / Math.max(1, robots.length);
  metrics.maxWaitTicks = Math.max(0, ...robots.map((robot) => robot.waitTicks));
}
function assignPath(robot: Robot) { robot.path = (findPath(layout, robot, robot.goal!) ?? []).map((p) => [p.x, p.y]); }
export { TICK_MS };
