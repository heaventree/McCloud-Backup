import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";
import logger from './utils/logger';

// Configure Neon to use websockets for serverless environments
neonConfig.webSocketConstructor = ws;

// Ensure DATABASE_URL is set
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Configure the connection pool with optimal settings for Replit environment
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

// Initialize Drizzle ORM with the connection pool
export const db = drizzle({ 
  client: pool, 
  schema,
  // Enable prepared statements for better performance and security
  // This can help reduce the impact of rate limiting by reusing query plans
  prepare: true,
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
