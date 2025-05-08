/**
 * PostgreSQL Connection Pool
 * 
 * This module provides a connection pool for PostgreSQL database using the Drizzle ORM.
 */
import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import * as schema from '../../shared/schema';
import logger from '../utils/logger';
import ws from 'ws';

// Configure Neon to use WebSockets
neonConfig.webSocketConstructor = ws;

// Create a PostgreSQL connection pool
const createPgClient = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL connection');
  }
  
  logger.info('Creating PostgreSQL client');
  
  // Return Neon pool with appropriate options
  return new Pool({ 
    connectionString,
    max: 10 // Maximum number of connections
  });
};

// Lazy-loaded database client and Drizzle ORM instance
let pgClient: Pool | null = null;
let drizzleDB: ReturnType<typeof drizzle> | null = null;

// Get or create database client
export const getPgClient = () => {
  if (!pgClient) {
    pgClient = createPgClient();
  }
  return pgClient;
};

// Get or create Drizzle ORM instance with our schema
export const getDrizzle = () => {
  if (!drizzleDB) {
    const client = getPgClient();
    drizzleDB = drizzle({ client, schema });
  }
  return drizzleDB;
};