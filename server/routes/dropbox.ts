import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { fetchDropboxAccountInfo, fetchDropboxSpaceUsage } from '../providers/dropbox';
import { pool } from '../db';

const router = Router();

/**
 * Route to get Dropbox account info and space usage for a storage provider
 */
router.get('/provider/:id', async (req: Request, res: Response) => {
  const providerId = parseInt(req.params.id);
  
  if (isNaN(providerId)) {
    return res.status(400).json({ error: 'Invalid provider ID' });
  }
  
  try {
    // Get the storage provider from the database
    const result = await pool.query(
      'SELECT * FROM storage_providers WHERE id = $1',
      [providerId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Storage provider not found' });
    }
    
    const provider = result.rows[0];
    
    if (provider.type !== 'dropbox') {
      return res.status(400).json({ error: 'Storage provider is not a Dropbox provider' });
    }
    
    // Parse config to get token
    const config = JSON.parse(provider.config);
    if (!config.token) {
      return res.status(400).json({ error: 'No token found for this provider' });
    }
    
    // Fetch account info and space usage in parallel
    const [accountInfo, spaceUsage] = await Promise.all([
      fetchDropboxAccountInfo(config.token),
      fetchDropboxSpaceUsage(config.token)
    ]);
    
    // Construct response
    const response = {
      accountInfo: {
        name: {
          given_name: accountInfo.name.given_name,
          surname: accountInfo.name.surname,
          display_name: accountInfo.name.display_name,
        },
        email: accountInfo.email,
        country: accountInfo.country,
        accountId: accountInfo.account_id,
        accountType: accountInfo.account_type['.tag']
      },
      spaceUsage: {
        used: spaceUsage.used,
        allocated: spaceUsage.allocation.allocated
      }
    };
    
    logger.info(`Successfully fetched Dropbox data for provider ${providerId}`);
    res.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to fetch Dropbox data for provider ${providerId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch Dropbox data',
      message: errorMessage
    });
  }
});

export default router;