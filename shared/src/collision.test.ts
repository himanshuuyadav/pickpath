import { describe, expect, it } from 'vitest';
import { arbitrate } from './collision.js';

describe('tick arbitration', () => {
  it('allows only one robot to claim an intersection', () => {
    const result = arbitrate([
      { id: 1, current: { x: 1, y: 0 }, next: { x: 1, y: 1 } },
      { id: 2, current: { x: 0, y: 1 }, next: { x: 1, y: 1 } },
    ], 0);
    expect(result.allowed).toEqual([1]);
    expect(result.blocked).toEqual([2]);
  });
  it('does not permit swaps', () => {
    const result = arbitrate([
      { id: 1, current: { x: 0, y: 0 }, next: { x: 1, y: 0 } },
      { id: 2, current: { x: 1, y: 0 }, next: { x: 0, y: 0 } },
    ], 0);
    expect(result.allowed).toEqual([]);
    expect(result.blocked).toEqual([1, 2]);
  });
  it('rotates the first claimant for fairness', () => {
    const intents = [
      { id: 1, current: { x: 1, y: 0 }, next: { x: 1, y: 1 } },
      { id: 2, current: { x: 0, y: 1 }, next: { x: 1, y: 1 } },
    ];
    expect(arbitrate(intents, 0).allowed).toEqual([1]);
    expect(arbitrate(intents, 1).allowed).toEqual([2]);
  });
  it('keeps a four robot cycle from moving into occupied cells', () => {
    const result = arbitrate([
      { id: 1, current: { x: 0, y: 0 }, next: { x: 1, y: 0 } },
      { id: 2, current: { x: 1, y: 0 }, next: { x: 1, y: 1 } },
      { id: 3, current: { x: 1, y: 1 }, next: { x: 0, y: 1 } },
      { id: 4, current: { x: 0, y: 1 }, next: { x: 0, y: 0 } },
    ], 0);
    expect(result.allowed).toEqual([]);
    expect(result.blocked).toHaveLength(4);
  });
  it('does not tailgate an occupied cell even when it will become free', () => {
    const result = arbitrate([
      { id: 1, current: { x: 0, y: 0 }, next: { x: 1, y: 0 } },
      { id: 2, current: { x: 1, y: 0 }, next: null },
    ], 0);
    expect(result.allowed).toEqual([]);
    expect(result.blocked).toEqual([1, 2]);
  });
});
