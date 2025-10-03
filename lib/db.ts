import "./env.js";
import { Pool, PoolClient, QueryResult, QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

type GlobalWithPool = typeof globalThis & { __pgPool?: Pool };
const globalWithPool = globalThis as GlobalWithPool;

const pool = globalWithPool.__pgPool || new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false }
});

if (!globalWithPool.__pgPool) {
  globalWithPool.__pgPool = pool;
}

export const query = <T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: readonly unknown[] = []
): Promise<QueryResult<T>> => {
  return pool.query<T>(text, params);
};

export const transaction = async <T>(fn: (client: PoolClient) => Promise<T>): Promise<T> => {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
};

export const getClient = () => pool.connect();
