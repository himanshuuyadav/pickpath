import { describe, expect, it } from 'vitest';
import { findPath } from './astar.js';
import { buildLayout, pointKey } from './layout.js';

describe('directed A*', () => {
  const layout = buildLayout();
  it('avoids blocked cells', () => {
    const path = findPath(layout, { x: 0, y: 19 }, { x: 4, y: 8 }, new Set(['4,8']));
    expect(path).toBeNull();
  });
  it('returns no path for an isolated goal', () => expect(findPath(layout, { x: 0, y: 19 }, { x: 5, y: 2 })).toBeNull());
  it('is deterministic', () => {
    const paths = Array.from({ length: 4 }, () => findPath(layout, { x: 0, y: 19 }, { x: 4, y: 8 })!.map(pointKey));
    expect(new Set(paths.map((path) => path.join('|'))).size).toBe(1);
  });
});
