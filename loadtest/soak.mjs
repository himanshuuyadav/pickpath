const base = process.env.BASE_URL ?? 'http://127.0.0.1:3001';
const durationMs = Number(process.env.SOAK_MS ?? 600000);
const end = Date.now() + durationMs;
let samples = 0;
let duplicateCells = 0;
let maxWaitTicks = 0;
let minRobots = Infinity;
let maxRobots = 0;
let requestErrors = 0;
while (Date.now() < end) {
  try {
    const [stateResponse, metricsResponse] = await Promise.all([fetch(`${base}/api/state`), fetch(`${base}/api/metrics`)]);
    const state = await stateResponse.json();
    const metrics = await metricsResponse.json();
    const cells = new Set();
    for (const robot of state.robots) {
      const cell = `${robot.x},${robot.y}`;
      if (cells.has(cell)) duplicateCells++;
      cells.add(cell);
    }
    samples++;
    maxWaitTicks = Math.max(maxWaitTicks, metrics.maxWaitTicks);
    minRobots = Math.min(minRobots, state.robots.length);
    maxRobots = Math.max(maxRobots, state.robots.length);
  } catch { requestErrors++; }
  await new Promise((resolve) => setTimeout(resolve, 1000));
}
const result = { durationMs, samples, duplicateCells, maxWaitTicks, minRobots, maxRobots, requestErrors };
console.log(JSON.stringify(result, null, 2));
if (duplicateCells > 0 || maxWaitTicks >= 60 || minRobots < 32 || requestErrors > 0) process.exitCode = 1;
