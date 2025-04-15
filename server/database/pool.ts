/**
 * Database Connection Pool
 * 
 * This module provides a connection pool for database operations,
 * optimizing performance and resource utilization.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import logger from '../utils/logger';

// Use the default logger instance

// Connection configuration
interface DbConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl: boolean;
  maxConnections: number;
  idleTimeout: number;
}

// Default configuration
const defaultConfig: DbConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  database: process.env.DB_NAME || 'mccloud',
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true',
  maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10', 10),
  idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000', 10) // 30 seconds
};

// Connection pool instance
let pool: postgres.Sql<{}> | null = null;
let drizzleInstance: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize the database connection pool
 * @param config Database configuration
 * @returns Database connection pool
 */
export async function initializePool(config: Partial<DbConfig> = {}): Promise<postgres.Sql<{}>> {
  if (pool) {
    return pool;
  }

  const mergedConfig: DbConfig = { ...defaultConfig, ...config };
  
  logger.info('Initializing database connection pool', {
    host: mergedConfig.host,
    port: mergedConfig.port,
    database: mergedConfig.database,
    maxConnections: mergedConfig.maxConnections,
    idleTimeout: mergedConfig.idleTimeout,
    ssl: mergedConfig.ssl
  });
  
  try {
    // Create connection pool
    pool = postgres({
      host: mergedConfig.host,
      port: mergedConfig.port,
      database: mergedConfig.database,
      user: mergedConfig.username,
      password: mergedConfig.password,
      ssl: mergedConfig.ssl,
      max: mergedConfig.maxConnections,
      idle_timeout: mergedConfig.idleTimeout,
      connect_timeout: 10, // 10 seconds
      
      // Debug options for development
      debug: process.env.NODE_ENV !== 'production',
      
      // Types config
      types: {
        // Add custom type parsers if needed
      },
      
      // Connection options
      connection: {
        application_name: 'mccloud-backup'
      },
      
      // Error handler
      onnotice: (notice) => {
        logger.info('Database notice', { notice });
      },
      
      // Connection events
      onconnect: () => {
        logger.debug('Database connection established');
      },
      
      // End events
      onend: () => {
        logger.debug('Database connection closed');
      }
    });
    
    // Test connection
    await testConnection();
    
    logger.info('Database connection pool initialized');
    return pool;
  } catch (error) {
    logger.error('Failed to initialize database connection pool', error);
    throw error;
  }
}

/**
 * Get the database connection pool
 * If not initialized, initializes with default config
 * @returns Database connection pool
 */
export async function getPool(): Promise<postgres.Sql<{}>> {
  if (!pool) {
    return initializePool();
  }
  return pool;
}

/**
 * Get a Drizzle ORM instance
 * @returns Drizzle ORM instance
 */
export async function getDrizzle(): Promise<ReturnType<typeof drizzle>> {
  if (!drizzleInstance) {
    const connectionPool = await getPool();
    drizzleInstance = drizzle(connectionPool);
  }
  return drizzleInstance;
}

/**
 * Run database migrations
 * @param migrationDir Directory containing migration files
 */
export async function runMigrations(migrationDir: string = './migrations'): Promise<void> {
  try {
    const db = await getDrizzle();
    
    logger.info('Running database migrations');
    await migrate(db, { migrationsFolder: migrationDir });
    logger.info('Database migrations completed');
  } catch (error) {
    logger.error('Failed to run database migrations', error);
    throw error;
  }
}

/**
 * Test the database connection
 * @returns True if connection is successful
 */
export async function testConnection(): Promise<boolean> {
  if (!pool) {
    throw new Error('Database connection pool not initialized');
  }
  
  try {
    // Run a simple query to test connection
    const result = await pool`SELECT 1 as test`;
    return result[0]?.test === 1;
  } catch (error) {
    logger.error('Database connection test failed', error);
    throw error;
  }
}

/**
 * Close the database connection pool
 */
export async function closePool(): Promise<void> {
  if (pool) {
    try {
      logger.info('Closing database connection pool');
      await pool.end();
      pool = null;
      drizzleInstance = null;
      logger.info('Database connection pool closed');
    } catch (error) {
      logger.error('Failed to close database connection pool', error);
      throw error;
    }
  }
}

/**
 * Get the connection pool status
 * @returns Pool status
 */
export async function getPoolStatus(): Promise<{
  initialized: boolean;
  activeConnections?: number;
  idleConnections?: number;
  waitingQueries?: number;
}> {
  if (!pool) {
    return { initialized: false };
  }
  
  // Note: postgres.js doesn't expose detailed pool stats directly,
  // so we're using a query to get connection info from Postgres
  try {
    const result = await pool`
      SELECT
        count(*) FILTER (WHERE state = 'active') as active,
        count(*) FILTER (WHERE state = 'idle') as idle,
        (SELECT count(*) FROM pg_stat_activity WHERE wait_event_type = 'Client') as waiting
      FROM pg_stat_activity
      WHERE application_name = 'mccloud-backup'
    `;
    
    return {
      initialized: true,
      activeConnections: parseInt(result[0]?.active || '0', 10),
      idleConnections: parseInt(result[0]?.idle || '0', 10),
      waitingQueries: parseInt(result[0]?.waiting || '0', 10)
    };
  } catch (error) {
    logger.error('Failed to get connection pool status', error);
    return { initialized: true };
  }
}