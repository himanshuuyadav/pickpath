import { buildLayout, findPath, type Point, type RobotState, type RobotView, type SimConfig, type Metrics, type SimEvent } from '@warehouse/shared';

type Robot = RobotView & { goal: Point | null; waitTicks: number };
const layout = buildLayout();
const metrics: Metrics = { ordersDispatched: 0, ordersRejected: 0, throughputPerHour: 0, latencyAvgMs: 0, latencyP95Ms: 0, robotUtilization: 0, backlog: 0, robotsActive: 0, maxWaitTicks: 0 };
const config: SimConfig = { robots: 12, orderRate: 0.5, running: false };
let robots: Robot[] = [];
let ticks = 0;
const events: SimEvent[] = [];

export function resetSim() { robots = Array.from({ length: config.robots }, (_, id) => ({ id: id + 1, x: id, y: 19, state: 'IDLE' as RobotState, taskId: null, path: [], goal: null, waitTicks: 0 })); metrics.robotsActive = robots.length; }
resetSim();
export function snapshot() { return { layout, config, robots: views(), metrics, events: events.slice(-12) }; }
export function views() { return robots.map(({ id, x, y, state, taskId, path }) => ({ id, x, y, state, taskId, path })); }
export function simMetrics() { return metrics; }
export function simConfig(input?: Partial<SimConfig>) { if (input) { Object.assign(config, input); if (input.robots !== undefined) resetSim(); } return config; }
export function tick() {
  ticks++;
  if (!config.running) return;
  for (const robot of robots) {
    if (robot.state === 'IDLE') assignWalk(robot);
    if (robot.path.length) { const next = robot.path.shift()!; robot.x = next[0]; robot.y = next[1]; }
    if (!robot.path.length && robot.goal) { if (robot.state === 'TO_SHELF') { robot.state = 'RETURNING'; robot.goal = { x: robot.id - 1, y: 19 }; assignPath(robot); } else { robot.state = 'IDLE'; robot.goal = null; } }
  }
  metrics.robotsActive = robots.length;
  metrics.robotUtilization = robots.filter((r) => r.state !== 'IDLE' && r.state !== 'FAILED').length / Math.max(1, robots.length);
}
function assignWalk(robot: Robot) { robot.state = 'TO_SHELF'; robot.goal = layout.shelfAccess[(ticks + robot.id * 7) % layout.shelfAccess.length]; assignPath(robot); }
function assignPath(robot: Robot) { robot.path = (findPath(layout, robot, robot.goal!) ?? []).map((p) => [p.x, p.y]); }
