import { equalPoint, pointKey, type Point } from './layout.js';

export type MoveIntent = { id: number; current: Point; next: Point | null };
export type Arbitration = { allowed: number[]; blocked: number[] };

/** Resolves one tick from a start-of-tick snapshot. No move can enter an occupied or claimed cell. */
export function arbitrate(intents: MoveIntent[], tick: number): Arbitration {
  const occupied = new Map(intents.map((intent) => [pointKey(intent.current), intent.id]));
  const ordered = intents.length ? intents.map((_, index) => intents[(index + tick) % intents.length]) : [];
  const claimed = new Set<string>();
  const allowed: number[] = [];
  const blocked: number[] = [];
  for (const intent of ordered) {
    if (!intent.next || equalPoint(intent.current, intent.next)) { blocked.push(intent.id); continue; }
    const nextKey = pointKey(intent.next);
    const occupant = occupied.get(nextKey);
    const occupantIntent = occupant === undefined ? undefined : intents.find((item) => item.id === occupant);
    const isSwap = occupantIntent?.next !== null && occupantIntent?.next !== undefined && equalPoint(occupantIntent.next, intent.current);
    if (occupant !== undefined || claimed.has(nextKey) || isSwap) { blocked.push(intent.id); continue; }
    claimed.add(nextKey);
    allowed.push(intent.id);
  }
  return { allowed, blocked };
}
