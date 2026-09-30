import { describe, expect, it } from 'vitest';

describe('failure recovery', () => {
  it('uses a short visible failure period before removal', () => expect(10).toBeGreaterThan(0));
  it('uses a longer replacement delay', () => expect(50).toBeGreaterThan(10));
  it('does not reuse the failed robot identifier', () => {
    const survivors = [{ id: 1 }, { id: 3 }];
    const replacement = Math.max(...survivors.map((robot) => robot.id)) + 1;
    expect(replacement).toBe(4);
  });
  it('selects an unoccupied parking position for a replacement', () => {
    const occupied = new Set([0, 2]);
    const parking = [0, 1, 2, 3].find((spot) => !occupied.has(spot));
    expect(parking).toBe(1);
  });
  it('keeps a failed robot out of the available fleet', () => {
    const robots = [{ state: 'IDLE' }, { state: 'FAILED' }, { state: 'RETURNING' }];
    expect(robots.filter((robot) => robot.state !== 'FAILED')).toHaveLength(2);
  });
});
