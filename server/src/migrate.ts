import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { database, withTransaction } from './db.js';
import { seedStock } from './seed.js';

export async function migrate() {
  await database.query('create table if not exists schema_migrations (name text primary key)');
  const folder = new URL('../migrations/', import.meta.url);
  const folderPath = fileURLToPath(folder);
  for (const name of (await readdir(folder)).filter((file) => file.endsWith('.sql')).sort()) {
    const applied = await database.query('select 1 from schema_migrations where name = $1', [name]);
    if (!applied.rowCount) await withTransaction(async (client) => { await client.query(await readFile(join(folderPath, name), 'utf8')); await client.query('insert into schema_migrations (name) values ($1)', [name]); });
  }
  await withTransaction(seedStock);
}
