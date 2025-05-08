import express from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { setupAuth } from "./auth";
import { setupMiddleware, setupErrorHandling } from "./middleware";
import logger from "./utils/logger";
import { createServer } from "http";
import path from "path";
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import cookieParser from "cookie-parser";
import { initializeSampleData } from "./database/init-sample-data";


dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: false, limit: '10mb' }));
app.use('/assets', express.static(path.join(__dirname, 'public/assets')));
app.use(cookieParser());

setupMiddleware(app);
setupAuth(app);

(async () => {
  try {
    const server = createServer(app);
    await registerRoutes(app);
    
    // Initialize database with sample data if database is empty
    try {
      await initializeSampleData();
    } catch (error) {
      logger.error('Failed to initialize sample data', { error });
    }
    
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
    }
    
    setupErrorHandling(app);
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
