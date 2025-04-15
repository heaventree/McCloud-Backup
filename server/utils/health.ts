/**
 * Health Check Routes and Utilities
 * 
 * This module provides health check endpoints and utilities to monitor
 * the application status and dependencies.
 */

import { Express, Request, Response } from 'express';
import os from 'os';
import logger from './logger';

/**
 * Register health check routes in the Express application
 * @param app Express application
 */
export function registerHealthRoutes(app: Express): void {
  // Basic health check endpoint
  app.get('/health', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'UP',
      timestamp: new Date().toISOString(),
    });
  });
  
  // Detailed health check with system information
  app.get('/health/detail', (req: Request, res: Response) => {
    const uptime = process.uptime();
    const memoryUsage = process.memoryUsage();
    
    const healthInfo = {
      status: 'UP',
      timestamp: new Date().toISOString(),
      process: {
        uptime: uptime,
        uptimeFormatted: formatUptime(uptime),
        pid: process.pid,
        memoryUsage: {
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)} MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)} MB`,
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)} MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)} MB`,
        },
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        version: process.version,
        cpus: os.cpus().length,
        totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)} MB`,
        freeMemory: `${Math.round(os.freemem() / 1024 / 1024)} MB`,
        loadAverage: os.loadavg(),
      },
    };
    
    res.status(200).json(healthInfo);
  });
  
  // Ready check - used to determine if the application is ready to serve requests
  app.get('/health/ready', (req: Request, res: Response) => {
    // Custom logic to check if the application is ready
    const isReady = true; // Implement your own readiness logic
    
    if (isReady) {
      res.status(200).json({
        status: 'READY',
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        status: 'NOT_READY',
        timestamp: new Date().toISOString(),
      });
    }
  });
  
  // Live check - used to determine if the application is alive
  app.get('/health/live', (req: Request, res: Response) => {
    res.status(200).json({
      status: 'ALIVE',
      timestamp: new Date().toISOString(),
    });
  });
  
  logger.info('Health check routes registered');
}

/**
 * Format uptime in a human-readable format
 * @param uptime Uptime in seconds
 * @returns Formatted uptime string
 */
function formatUptime(uptime: number): string {
  const days = Math.floor(uptime / (24 * 60 * 60));
  const hours = Math.floor((uptime % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((uptime % (60 * 60)) / 60);
  const seconds = Math.floor(uptime % 60);
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);
  
  return parts.join(' ');
}

export default {
  registerHealthRoutes,
};