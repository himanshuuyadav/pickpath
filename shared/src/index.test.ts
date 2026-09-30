import { describe, expect, it } from 'vitest';
import { GRID_HEIGHT, GRID_WIDTH } from './index.js';

describe('grid dimensions', () => {
  it('matches the warehouse specification', () => {
    expect([GRID_WIDTH, GRID_HEIGHT]).toEqual([32, 20]);
  });
});
