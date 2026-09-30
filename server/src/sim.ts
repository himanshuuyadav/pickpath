import { arbitrate, buildLayout, findPath, type Point, type RobotState, type RobotView, type SimConfig, type Metrics, type SimEvent } from '@warehouse/shared';
import { DROP_TICKS, FAILED_VISIBLE_TICKS, PACK_TICKS, PICK_TICKS, RESPAWN_TICKS, TICK_MS, WAIT_REPLAN } from './constants.js';
import { schedule } from './scheduler.js';
import { generateOrder, replenishStock } from './generator.js';
import { completeTask, dispatchReadyOrders, markTaskPicked, pendingTaskCount } from './tasks.js';
import { requeueRobotTask } from './failures.js';

type Robot = RobotView & { goal: Point | null; waitTicks: number; actionTicks: number; failedAt: number | null };
const layout = buildLayout();
const metrics: Metrics = { ordersDispatched: 0, ordersRejected: 0, throughputPerHour: 0, latencyAvgMs: 0, latencyP95Ms: 0, robotUtilization: 0, backlog: 0, robotsActive: 0, maxWaitTicks: 0 };
const config: SimConfig = { robots: 12, orderRate: 0.5, running: false };
let robots: Robot[] = [];
let ticks = 0;
let nextRobotId = 1;
const events: SimEvent[] = [];
const respawns: number[] = [];

export function resetSim() { robots = Array.from({ length: config.robots }, (_, id) => ({ id: id + 1, x: id, y: 19, state: 'IDLE' as RobotState, taskId: null, path: [], goal: null, waitTicks: 0, actionTicks: 0, failedAt: null })); nextRobotId = config.robots + 1; respawns.length = 0; metrics.robotsActive = robots.length; }
resetSim();
export function snapshot() { return { layout, config, robots: views(), metrics, events: events.slice(-12) }; }
export function views() { return robots.map(({ id, x, y, state, taskId, path }) => ({ id, x, y, state, taskId, path })); }
export function simMetrics() { return metrics; }
export function simConfig(input?: Partial<SimConfig>) { if (input) { Object.assign(config, input); if (input.robots !== undefined) resetSim(); } return config; }
export async function killRobot(id: number) {
  const robot = robots.find((item) => item.id === id && item.state !== 'FAILED');
  if (!robot) return false;
  const taskId = robot.taskId ? await requeueRobotTask(robot.id) : null;
  robot.state = 'FAILED'; robot.path = []; robot.goal = null; robot.taskId = null; robot.failedAt = ticks;
  events.push({ ts: Date.now(), kind: 'ROBOT_FAILED', text: `Robot ${robot.id} failed`, robotId: robot.id });
  if (taskId) events.push({ ts: Date.now(), kind: 'TASK_REQUEUED', text: `Task ${taskId} requeued`, robotId: robot.id });
  return true;
}
export async function tick() {
  ticks++;
  if (!config.running) return;
  removeFailedRobots();
  spawnReplacements();
  if (ticks % 5 === 0) {
    metrics.backlog = await pendingTaskCount();
    if (metrics.backlog <= 200) {
      const count = Math.floor(config.orderRate) + (Math.random() < config.orderRate % 1 ? 1 : 0);
      for (let index = 0; index < count; index++) {
        try { await generateOrder(); } catch { metrics.ordersRejected++; }
      }
    }
  }
  if (ticks % 150 === 0) await replenishStock();
  const dispatched = await dispatchReadyOrders(new Date(Date.now() - PACK_TICKS * TICK_MS));
  metrics.ordersDispatched += dispatched.length;
  const assignments = await schedule(robots.filter((robot) => robot.state === 'IDLE' || robot.state === 'RETURNING').map((robot) => ({ id: robot.id, position: robot })));
  for (const assignment of assignments) {
    const robot = robots.find((item) => item.id === assignment.robotId)!;
    robot.state = 'TO_SHELF'; robot.taskId = assignment.taskId; robot.goal = assignment.access;
    robot.path = assignment.path.map((point) => [point.x, point.y]);
  }
  const motion = arbitrate(robots.map((robot) => ({ id: robot.id, current: robot, next: robot.path[0] ? { x: robot.path[0][0], y: robot.path[0][1] } : null })), ticks);
  const canMove = new Set(motion.allowed);
  for (const robot of robots) {
    if (robot.state === 'PICKING' || robot.state === 'DROPPING') {
      robot.actionTicks--;
      if (robot.actionTicks > 0) continue;
      if (robot.state === 'PICKING') { robot.state = 'TO_STATION'; robot.goal = availableStation(robot); assignPath(robot); }
      else { if (robot.taskId) await completeTask(robot.taskId); robot.state = 'RETURNING'; robot.taskId = null; robot.goal = { x: robot.id - 1, y: 19 }; assignPath(robot); }
      continue;
    }
    if (robot.path.length && canMove.has(robot.id)) { const next = robot.path.shift()!; robot.x = next[0]; robot.y = next[1]; robot.waitTicks = 0; }
    else if (robot.path.length) {
      robot.waitTicks++;
      if (robot.waitTicks >= WAIT_REPLAN && robot.goal) replanAroundRobots(robot);
    }
    if (!robot.path.length && robot.goal) {
      if (robot.state === 'TO_SHELF') { await markTaskPicked(robot.taskId!); robot.state = 'PICKING'; robot.actionTicks = PICK_TICKS; }
      else if (robot.state === 'TO_STATION') {
        const station = availableStation(robot);
        if (station.x === 3 && station.y === 9) { continue; }
        if (robot.goal?.x === 3 && robot.goal.y === 9) { robot.goal = station; assignPath(robot); continue; }
        robot.goal = station;
        robot.state = 'DROPPING'; robot.actionTicks = DROP_TICKS;
      }
      else { robot.state = 'IDLE'; robot.goal = null; robot.taskId = null; }
    }
  }
  metrics.robotsActive = robots.length;
  metrics.robotUtilization = robots.filter((r) => r.state !== 'IDLE' && r.state !== 'FAILED').length / Math.max(1, robots.length);
  metrics.maxWaitTicks = Math.max(0, ...robots.map((robot) => robot.waitTicks));
}
function removeFailedRobots() {
  for (const robot of robots.filter((item) => item.state === 'FAILED' && item.failedAt !== null && ticks - item.failedAt >= FAILED_VISIBLE_TICKS)) {
    robots = robots.filter((item) => item.id !== robot.id);
    respawns.push(ticks + RESPAWN_TICKS);
  }
}
function spawnReplacements() {
  while (respawns[0] !== undefined && respawns[0] <= ticks) {
    respawns.shift();
    const occupied = new Set(robots.map((robot) => robot.x));
    const parking = layout.parking.find((spot) => !occupied.has(spot.x));
    if (!parking) continue;
    const id = nextRobotId++;
    robots.push({ id, x: parking.x, y: parking.y, state: 'IDLE', taskId: null, path: [], goal: null, waitTicks: 0, actionTicks: 0, failedAt: null });
    events.push({ ts: Date.now(), kind: 'ROBOT_RESPAWNED', text: `Robot ${id} joined the fleet`, robotId: id });
  }
}
function assignPath(robot: Robot) { robot.path = (findPath(layout, robot, robot.goal!) ?? []).map((p) => [p.x, p.y]); }
function replanAroundRobots(robot: Robot) {
  const blocked = new Set(robots.filter((other) => other.id !== robot.id).map((other) => `${other.x},${other.y}`));
  blocked.delete(`${robot.goal!.x},${robot.goal!.y}`);
  const path = findPath(layout, robot, robot.goal!, blocked);
  if (path) { robot.path = path.map((point) => [point.x, point.y]); robot.waitTicks = 0; }
}
function availableStation(robot: Robot) {
  const claimed = new Set(robots.filter((other) => other.id !== robot.id && (other.state === 'TO_STATION' || other.state === 'DROPPING')).map((other) => `${other.goal?.x},${other.goal?.y}`));
  return layout.stations.find((station) => !claimed.has(`${station.x},${station.y}`)) ?? { x: 3, y: 9 };
}
export { TICK_MS };
