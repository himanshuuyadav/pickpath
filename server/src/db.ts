import { Pool } from 'pg';

export const database = new Pool({ connectionString: process.env.DATABASE_URL ?? 'postgres://warehouse:warehouse@localhost:5432/warehouse', max: 10 });

export async function withTransaction<T>(work: (client: import('pg').PoolClient) => Promise<T>) {
  const client = await database.connect();
  try { await client.query('begin'); const value = await work(client); await client.query('commit'); return value; }
  catch (error) { await client.query('rollback'); throw error; }
  finally { client.release(); }
}
