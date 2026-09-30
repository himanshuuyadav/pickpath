import { describe, expect, it } from 'vitest';
import { validateOrder } from './orders.js';

describe('order validation', () => {
  it('accepts a valid order', () => expect(validateOrder({ items: [{ sku: 'SKU-001', qty: 2 }], priority: 1 })).toBe(true));
  it('rejects invalid quantities and priority', () => {
    expect(validateOrder({ items: [{ sku: 'SKU-001', qty: 0 }] })).toBe(false);
    expect(validateOrder({ items: [{ sku: 'SKU-001', qty: 1 }], priority: 3 })).toBe(false);
  });
});
