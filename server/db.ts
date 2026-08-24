// Uses plain node-postgres (`pg`), not @neondatabase/serverless. The latter's Pool speaks
// Neon's WebSocket proxy protocol specifically and cannot connect to a plain/self-hosted
// Postgres - confirmed live against production's actual DB (a local Postgres on the VPS
// itself, not Neon): it throws a WebSocket ErrorEvent that the /start error handler
// flattened to an undiagnosable "Unknown error". This app has never run on Neon in
// production, so `pg` is the correct driver here, not a workaround.
import pg from 'pg';
const { Pool } = pg;
import { drizzle } from 'drizzle-orm/node-postgres';
import * as schema from "@shared/schema";
import logger from './utils/logger';

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the connection pool with optimal settings
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Return an error after 10 seconds if a connection couldn't be established
});

// Add event handlers for better debugging and monitoring
pool.on('error', (err) => {
  logger.error('Unexpected error on idle database client', { error: err });
});

pool.on('connect', () => {
  logger.debug('New database connection established');
});

// Initialize Drizzle ORM with the connection pool.
// `prepare` isn't a node-postgres option (that was Neon/postgres.js-specific) - pg's Pool
// already uses server-side prepared statements per query internally, no config needed.
export const db = drizzle({
  client: pool,
  schema,
});

// Helper function to manage database connections in high-traffic situations
export async function withConnection<T>(callback: (client: any) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

// Simple query cache to reduce database load
const queryCache = new Map<string, { data: any; timestamp: number }>();
const CACHE_TTL = 60000; // 1 minute cache TTL

export async function cachedQuery<T>(
  cacheKey: string, 
  queryFn: () => Promise<T>,
  ttl: number = CACHE_TTL
): Promise<T> {
  const now = Date.now();
  const cached = queryCache.get(cacheKey);
  
  if (cached && now - cached.timestamp < ttl) {
    logger.debug('Using cached database query result', { cacheKey });
    return cached.data as T;
  }
  
  const result = await queryFn();
  queryCache.set(cacheKey, { data: result, timestamp: now });
  return result;
}
