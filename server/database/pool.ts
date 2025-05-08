/**
 * PostgreSQL Connection Pool
 * 
 * This module provides a connection pool for PostgreSQL database using the Drizzle ORM.
 */
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from '../../shared/schema';
import logger from '../utils/logger';

// Create a PostgreSQL connection pool
const createPgClient = () => {
  const connectionString = process.env.DATABASE_URL;
  
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL connection');
  }
  
  logger.info('Creating PostgreSQL client');
  
  // Return postgres client with appropriate options
  return postgres(connectionString, {
    max: 10, // Maximum number of connections
    idle_timeout: 20, // Max idle time for connections in seconds
    connect_timeout: 10, // Connection timeout in seconds
    prepare: false, // Disable prepared statements for broader compatibility
  });
};

// Lazy-loaded database client and Drizzle ORM instance
let pgClient: ReturnType<typeof postgres> | null = null;
let drizzleDB: ReturnType<typeof drizzle<typeof schema>> | null = null;

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
    drizzleDB = drizzle(client, { schema });
  }
  return drizzleDB;
};