import { PrismaClient } from '@prisma/client';

// Create a global instance of Prisma to be used across the application
// This prevents multiple instances from being created during hot reloading in development
declare global {
  var prisma: PrismaClient | undefined;
}

// If prisma client doesn't exist in global, create one
const prisma = global.prisma || new PrismaClient();

// In development, save the client to global to prevent multiple instances
if (process.env.NODE_ENV === 'development') {
  global.prisma = prisma;
}

export default prisma;