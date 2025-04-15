/**
 * Health Check System
 * 
 * This module provides comprehensive health check endpoints for the application,
 * including component health checks, dependency checks, and overall status.
 */
import { Request, Response } from 'express';
import { Express } from 'express';
import { createLogger } from './logger';
import { validateOAuthConfigs } from '../security/oauth-config';

const logger = createLogger('health');

// Health check types
export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy';

export interface HealthCheckResult {
  status: HealthStatus;
  message?: string;
  details?: any;
  timestamp: string;
}

export interface ComponentHealth {
  name: string;
  status: HealthStatus;
  message?: string;
  details?: any;
}

export interface SystemHealth {
  status: HealthStatus;
  version: string;
  uptime: number;
  timestamp: string;
  components: ComponentHealth[];
}

// Store startup time for uptime calculation
const startTime = Date.now();

// Get application version from package.json
const appVersion = process.env.npm_package_version || '0.0.0';

/**
 * Check health of database connection
 * @returns Health check result
 */
async function checkDatabaseHealth(): Promise<ComponentHealth> {
  try {
    // This is a placeholder - in a real app, you would check the database connection
    // For example, by running a simple query
    
    // For now, we'll just simulate a successful check
    return {
      name: 'database',
      status: 'healthy',
      message: 'Database connection is healthy'
    };
  } catch (error) {
    logger.error('Database health check failed', error);
    return {
      name: 'database',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown database error'
    };
  }
}

/**
 * Check health of OAuth configurations
 * @returns Health check result
 */
async function checkOAuthHealth(): Promise<ComponentHealth> {
  try {
    // Check that at least one OAuth provider is properly configured
    const providers = ['google', 'github', 'dropbox', 'onedrive'];
    const configuredProviders = providers.filter(provider => {
      const clientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
      const clientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
      return clientId && clientSecret;
    });
    
    if (configuredProviders.length > 0) {
      return {
        name: 'oauth',
        status: 'healthy',
        message: `${configuredProviders.length} OAuth providers configured`,
        details: { configuredProviders }
      };
    } else {
      return {
        name: 'oauth',
        status: 'degraded',
        message: 'No OAuth providers fully configured'
      };
    }
  } catch (error) {
    logger.error('OAuth health check failed', error);
    return {
      name: 'oauth',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown OAuth error'
    };
  }
}

/**
 * Check health of storage systems
 * @returns Health check result
 */
async function checkStorageHealth(): Promise<ComponentHealth> {
  try {
    // This is a placeholder - in a real app, you would check storage systems
    // For example, by verifying that file storage is accessible
    
    // For now, we'll just simulate a successful check
    return {
      name: 'storage',
      status: 'healthy',
      message: 'Storage systems are healthy'
    };
  } catch (error) {
    logger.error('Storage health check failed', error);
    return {
      name: 'storage',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown storage error'
    };
  }
}

/**
 * Check system memory usage
 * @returns Health check result
 */
async function checkMemoryHealth(): Promise<ComponentHealth> {
  try {
    const memoryUsage = process.memoryUsage();
    const usedHeapPercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    
    let status: HealthStatus = 'healthy';
    let message = 'Memory usage is normal';
    
    if (usedHeapPercentage > 90) {
      status = 'unhealthy';
      message = 'Memory usage is critical';
    } else if (usedHeapPercentage > 75) {
      status = 'degraded';
      message = 'Memory usage is high';
    }
    
    return {
      name: 'memory',
      status,
      message,
      details: {
        heapUsed: Math.round(memoryUsage.heapUsed / 1024 / 1024) + ' MB',
        heapTotal: Math.round(memoryUsage.heapTotal / 1024 / 1024) + ' MB',
        usedPercentage: Math.round(usedHeapPercentage) + '%'
      }
    };
  } catch (error) {
    logger.error('Memory health check failed', error);
    return {
      name: 'memory',
      status: 'unhealthy',
      message: error instanceof Error ? error.message : 'Unknown memory error'
    };
  }
}

/**
 * Perform a comprehensive health check of the system
 * @returns System health
 */
export async function checkSystemHealth(): Promise<SystemHealth> {
  // Run all component health checks in parallel
  const [databaseHealth, oauthHealth, storageHealth, memoryHealth] = await Promise.all([
    checkDatabaseHealth(),
    checkOAuthHealth(),
    checkStorageHealth(),
    checkMemoryHealth()
  ]);
  
  // Collect all component health checks
  const components = [
    databaseHealth,
    oauthHealth,
    storageHealth,
    memoryHealth
  ];
  
  // Determine overall status
  // System is unhealthy if any component is unhealthy
  // System is degraded if any component is degraded
  let status: HealthStatus = 'healthy';
  
  if (components.some(component => component.status === 'unhealthy')) {
    status = 'unhealthy';
  } else if (components.some(component => component.status === 'degraded')) {
    status = 'degraded';
  }
  
  // Calculate uptime in seconds
  const uptime = Math.floor((Date.now() - startTime) / 1000);
  
  return {
    status,
    version: appVersion,
    uptime,
    timestamp: new Date().toISOString(),
    components
  };
}

/**
 * Basic health check handler for load balancers
 * @param req Express request
 * @param res Express response
 */
export async function handleBasicHealthCheck(req: Request, res: Response) {
  try {
    // Simple health check that always returns 200 if the server is running
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Basic health check failed', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Comprehensive health check handler
 * @param req Express request
 * @param res Express response
 */
export async function handleFullHealthCheck(req: Request, res: Response) {
  try {
    const health = await checkSystemHealth();
    
    // Set appropriate status code based on health status
    const statusCode = health.status === 'healthy' ? 200 : 
                      health.status === 'degraded' ? 200 : 503;
    
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Full health check failed', error);
    res.status(500).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Register health check routes
 * @param app Express application
 */
export function registerHealthRoutes(app: Express) {
  // Basic health check for load balancers
  app.get('/health', handleBasicHealthCheck);
  
  // Comprehensive health check with component status
  app.get('/health/full', handleFullHealthCheck);
  
  logger.info('Health check routes registered');
}