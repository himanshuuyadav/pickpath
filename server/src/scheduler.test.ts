import { buildLayout } from '@warehouse/shared';
import { describe, expect, it } from 'vitest';
import { chooseRobotForAccess } from './scheduler.js';

describe('scheduler selection', () => {
  it('uses distance before robot id as a tie breaker', () => {
    const robots = [{ id: 2, distance: 4 }, { id: 1, distance: 4 }].sort((a, b) => a.distance - b.distance || a.id - b.id);
    expect(robots[0].id).toBe(1);
  });
  it('chooses the shortest reachable path and then the lowest id', () => {
    const layout = buildLayout();
    const access = layout.shelfAccess[0];
    const choice = chooseRobotForAccess([
      { id: 2, position: layout.parking[0] },
      { id: 1, position: layout.parking[0] },
    ], access);
    expect(choice?.robot.id).toBe(1);
    expect(choice?.path.at(-1)).toEqual(access);
  });
});
