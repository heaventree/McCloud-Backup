// Script to create a new admin user in the database
// Run with: node scripts/createUser.js

import { scrypt, randomBytes } from 'crypto';
import { promisify } from 'util';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const scryptAsync = promisify(scrypt);

async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const buf = await scryptAsync(password, salt, 64);
  return `${buf.toString('hex')}.${salt}`;
}

async function createUser() {
  try {
    // Check if the user already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: 'admin' }
    });

    if (existingUser) {
      console.log('User admin already exists, skipping creation.');
      return;
    }

    // Hash the password
    const hashedPassword = await hashPassword('password123');

    // Create the user
    const user = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
        // createdAt and updatedAt will be handled automatically
      }
    });

    console.log('User created successfully:', user.username);
  } catch (error) {
    console.error('Error creating user:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createUser();