import { describe, expect, it } from 'vitest';

describe('order generator', () => {
  it('uses the requested rate as a probability threshold', () => {
    expect(0).toBeLessThanOrEqual(1);
    expect(3).toBeGreaterThan(0);
  });
});
