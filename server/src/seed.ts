import { buildLayout } from '@warehouse/shared';
import type { PoolClient } from 'pg';

const products = ['USB cable', 'Keyboard', 'Phone case', 'Mouse', 'Webcam', 'Headset', 'Laptop stand', 'HDMI cable'];

export async function seedStock(client: PoolClient) {
  const shelves = buildLayout().cells.flatMap((row, y) => row.map((cell, x) => ({ cell, x, y })).filter(({ cell }) => cell === 'shelf'));
  for (let index = 0; index < shelves.length; index++) {
    const sku = index === 191 ? 'RACE-001' : `SKU-${String(index + 1).padStart(3, '0')}`;
    const shelf = shelves[index];
    await client.query('insert into stock (sku,name,shelf_x,shelf_y,on_hand,reserved) values ($1,$2,$3,$4,50,0) on conflict (sku) do nothing', [sku, `${products[index % products.length]} ${index + 1}`, shelf.x, shelf.y]);
  }
}
