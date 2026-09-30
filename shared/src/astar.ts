import { type Layout, type Point, equalPoint, neighbours, pointKey } from './layout.js';

export function findPath(layout: Layout, start: Point, goal: Point, blocked = new Set<string>()): Point[] | null {
  if (blocked.has(pointKey(start)) || blocked.has(pointKey(goal))) return null;
  const frontier: Point[] = [start];
  const from = new Map<string, Point>();
  const cost = new Map([[pointKey(start), 0]]);
  while (frontier.length) {
    frontier.sort((a, b) => (cost.get(pointKey(a))! + distance(a, goal)) - (cost.get(pointKey(b))! + distance(b, goal)) || pointKey(a).localeCompare(pointKey(b)));
    const current = frontier.shift()!;
    if (equalPoint(current, goal)) return unwind(from, start, goal);
    for (const next of neighbours(layout, current)) {
      const nextKey = pointKey(next);
      if (blocked.has(nextKey)) continue;
      const nextCost = cost.get(pointKey(current))! + 1;
      if (nextCost < (cost.get(nextKey) ?? Infinity)) { cost.set(nextKey, nextCost); from.set(nextKey, current); frontier.push(next); }
    }
  }
  return null;
}

const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
function unwind(from: Map<string, Point>, start: Point, goal: Point) {
  const path: Point[] = [goal];
  while (!equalPoint(path[0], start)) path.unshift(from.get(pointKey(path[0]))!);
  return path.slice(1);
}
