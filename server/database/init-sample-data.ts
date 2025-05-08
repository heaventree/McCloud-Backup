import { getDrizzle } from './pool';
import { sites, storageProviders, backupSchedules, backups, users } from '@shared/schema';
import logger from '../utils/logger';

export async function initializeSampleData() {
  try {
    const db = getDrizzle();
    logger.info('Initializing database with sample data');

    // Check if users table is empty
    const existingUsers = await db.select().from(users);
    if (existingUsers.length === 0) {
      // Add admin user
      const [user] = await db.insert(users).values({
        username: 'admin',
        password: 'password123' // In a real app, this would be hashed
      }).returning();
      logger.info('Created admin user', { userId: user.id });
    } else {
      logger.info('Admin user already exists, skipping creation');
    }

    // Check if sites table is empty
    const existingSites = await db.select().from(sites);
    if (existingSites.length === 0) {
      // Create sample sites
      const [site1] = await db.insert(sites).values({
        name: 'Main Website',
        url: 'example.com',
        apiKey: 'site1_api_key'
      }).returning();
      
      const [site2] = await db.insert(sites).values({
        name: 'Blog',
        url: 'blog.example.com',
        apiKey: 'site2_api_key'
      }).returning();
      
      const [site3] = await db.insert(sites).values({
        name: 'Shop',
        url: 'shop.example.com',
        apiKey: 'site3_api_key'
      }).returning();

      logger.info('Created sample sites', { 
        site1Id: site1.id, 
        site2Id: site2.id, 
        site3Id: site3.id 
      });

      // Check if storage providers table is empty
      const existingProviders = await db.select().from(storageProviders);
      if (existingProviders.length === 0) {
        // Create sample storage providers
        const [provider1] = await db.insert(storageProviders).values({
          name: 'Google Drive',
          type: 'google_drive',
          credentials: { token: 'sample_token' },
          quota: 1099511627776 // 1 TB
        }).returning();
        
        const [provider2] = await db.insert(storageProviders).values({
          name: 'Dropbox',
          type: 'dropbox',
          credentials: { token: 'sample_token' },
          quota: 536870912000 // 500 GB
        }).returning();
        
        const [provider3] = await db.insert(storageProviders).values({
          name: 'Amazon S3',
          type: 's3',
          credentials: { 
            accessKey: 'sample_access_key',
            secretKey: 'sample_secret_key',
            bucket: 'sample-bucket'
          },
          quota: 2199023255552 // 2 TB
        }).returning();
        
        const [provider4] = await db.insert(storageProviders).values({
          name: 'Microsoft OneDrive',
          type: 'onedrive',
          credentials: { 
            clientId: 'sample_client_id',
            clientSecret: 'sample_client_secret',
            token: 'sample_token',
            refreshToken: 'sample_refresh_token'
          },
          quota: 1073741824000 // 1 TB
        }).returning();

        logger.info('Created sample storage providers', {
          provider1Id: provider1.id,
          provider2Id: provider2.id,
          provider3Id: provider3.id,
          provider4Id: provider4.id
        });

        // Create sample backup schedules
        // Calculate next run time for schedules
        const now = new Date();
        
        const nextRunDaily1 = new Date(now);
        nextRunDaily1.setHours(18, 0, 0, 0);
        if (nextRunDaily1 <= now) {
          nextRunDaily1.setDate(nextRunDaily1.getDate() + 1);
        }
        
        const nextRunDaily2 = new Date(now);
        nextRunDaily2.setHours(22, 0, 0, 0);
        if (nextRunDaily2 <= now) {
          nextRunDaily2.setDate(nextRunDaily2.getDate() + 1);
        }
        
        const nextRunDaily3 = new Date(now);
        nextRunDaily3.setHours(3, 0, 0, 0);
        if (nextRunDaily3 <= now) {
          nextRunDaily3.setDate(nextRunDaily3.getDate() + 1);
        }

        await db.insert(backupSchedules).values({
          siteId: site1.id,
          storageProviderId: provider1.id,
          frequency: 'daily',
          hourOfDay: 18,
          minuteOfHour: 0,
          backupType: 'full',
          enabled: true,
          nextRun: nextRunDaily1
        });

        await db.insert(backupSchedules).values({
          siteId: site2.id,
          storageProviderId: provider2.id,
          frequency: 'daily',
          hourOfDay: 22,
          minuteOfHour: 0,
          backupType: 'incremental',
          fullBackupFrequency: 7,
          enabled: true,
          nextRun: nextRunDaily2
        });

        await db.insert(backupSchedules).values({
          siteId: site3.id,
          storageProviderId: provider3.id,
          frequency: 'daily',
          hourOfDay: 3,
          minuteOfHour: 0,
          backupType: 'full',
          enabled: true,
          nextRun: nextRunDaily3
        });

        logger.info('Created sample backup schedules');

        // Create sample backups
        const [backup1] = await db.insert(backups).values({
          siteId: site1.id,
          storageProviderId: provider1.id,
          status: 'completed',
          size: 256901120, // 245 MB
          fileCount: 1250,
          startedAt: new Date(),
          completedAt: new Date(Date.now() + 15 * 60 * 1000) // 15 minutes later
        }).returning();

        const [backup2] = await db.insert(backups).values({
          siteId: site2.id,
          storageProviderId: provider2.id,
          status: 'failed',
          startedAt: new Date(),
          error: 'Connection error'
        }).returning();

        await db.insert(backups).values({
          siteId: site3.id,
          storageProviderId: provider3.id,
          status: 'completed',
          size: 1288490188, // 1.2 GB
          fileCount: 5432,
          startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000), // Yesterday
          completedAt: new Date(Date.now() - 23 * 60 * 60 * 1000) // 23 hours ago
        });
        
        // Create a sample backup for OneDrive
        await db.insert(backups).values({
          siteId: site1.id,
          storageProviderId: provider4.id,
          status: 'completed',
          size: 524288000, // 500 MB
          fileCount: 2300,
          startedAt: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
          completedAt: new Date(Date.now() - 11 * 60 * 60 * 1000) // 11 hours ago
        });

        logger.info('Created sample backups');
      } else {
        logger.info('Storage providers already exist, skipping creation');
      }
    } else {
      logger.info('Sites already exist, skipping sample data creation');
    }

    logger.info('Sample data initialization complete');
    return true;
  } catch (error) {
    logger.error('Error initializing sample data', { error });
    return false;
  }
}