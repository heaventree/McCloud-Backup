import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { setupMiddleware, setupErrorHandling } from "./middleware";
import logger from "./utils/logger";
import { createServer } from "http";

// Create application logger
// Use the default logger instance

// Initialize Express application
const app = express();

// Basic middleware setup
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));

// Initialize comprehensive middleware configuration
setupMiddleware(app);

// Initialize authentication system
setupAuth(app);

(async () => {
  try {
    // Create server
    const server = createServer(app);
    
    // Set up Vite or static file serving first for the root route
    // This will take precedence for frontend routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    
    // Register API routes (these should all be under /api)
    await registerRoutes(app);
    
    // Set up error handling middleware (must be after routes)
    setupErrorHandling(app);
    
    // ALWAYS serve the app on port 5000
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = process.env.PORT || 5000;
    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      logger.info(`Server started and listening on port ${port}`);
      log(`serving on port ${port}`);
    });
    
    // Handle graceful shutdown
    const gracefulShutdown = () => {
      logger.info('Received shutdown signal, closing server...');
      server.close(() => {
        logger.info('Server closed successfully');
        process.exit(0);
      });
      
      // Force close after timeout
      setTimeout(() => {
        logger.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 10000);
    };
    
    // Listen for termination signals
    process.on('SIGTERM', gracefulShutdown);
    process.on('SIGINT', gracefulShutdown);
    
  } catch (error) {
    logger.error('Failed to start server', error);
    process.exit(1);
  }
})();
