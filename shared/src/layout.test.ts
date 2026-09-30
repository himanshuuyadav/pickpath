import { describe, expect, it } from 'vitest';
import { findPath } from './astar.js';
import { buildLayout } from './layout.js';

describe('warehouse layout', () => {
  const layout = buildLayout();
  it('reaches each shelf access cell from every parking cell', () => {
    for (const parking of layout.parking) for (const access of layout.shelfAccess) {
      expect(findPath(layout, parking, access), `${parking.x},${parking.y} -> ${access.x},${access.y}`).not.toBeNull();
    }
  }, 15_000);
  it('connects every shelf access cell to station and back to parking', () => {
    for (const access of layout.shelfAccess) for (const station of layout.stations) {
      expect(findPath(layout, access, station)).not.toBeNull();
      expect(findPath(layout, station, access)).not.toBeNull();
    }
  });
  it('does not allow shelf cells as destinations', () => {
    expect(findPath(layout, { x: 4, y: 2 }, { x: 5, y: 2 })).toBeNull();
  });
});
