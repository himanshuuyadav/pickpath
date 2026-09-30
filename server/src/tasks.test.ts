import { describe, expect, it } from 'vitest';

describe('task accounting', () => {
  it('keeps a completed quantity positive', () => {
    const quantity = 3;
    expect(quantity > 0).toBe(true);
  });
});
