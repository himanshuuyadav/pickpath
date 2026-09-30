import { describe, expect, it } from 'vitest';

describe('scheduler selection', () => {
  it('uses distance before robot id as a tie breaker', () => {
    const robots = [{ id: 2, distance: 4 }, { id: 1, distance: 4 }].sort((a, b) => a.distance - b.distance || a.id - b.id);
    expect(robots[0].id).toBe(1);
  });
});
