import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { fetchDropboxAccountInfo, fetchDropboxSpaceUsage } from '../providers/dropbox';
import { pool } from '../db';
import { decryptData } from '../security/encryption';

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
    
    // Get the raw config string from the database
    let rawConfig = provider.config;
    let config;
    let tokenValue;
    
    logger.info(`Provider config for ${providerId} - Type: ${typeof rawConfig}, Length: ${rawConfig ? rawConfig.length : 0}`);
    
    // First try to decrypt the entire config object (if it's encrypted)
    try {
      const decryptedConfig = await decryptData(rawConfig);
      logger.info(`Successfully decrypted entire config object for provider ${providerId}`);
      rawConfig = decryptedConfig;
    } catch (decryptError) {
      const errorMessage = decryptError instanceof Error ? decryptError.message : 'Unknown error';
      logger.info(`Config is either not encrypted or using a different encryption method: ${errorMessage}`);
      // Continue with the raw config if decryption fails
    }
    
    // Now try to parse the JSON
    try {
      config = JSON.parse(rawConfig);
      logger.info(`Successfully parsed JSON config for provider ${providerId}, keys: ${Object.keys(config).join(', ')}`);
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      logger.error(`Failed to parse config JSON: ${errorMessage}`);
      return res.status(400).json({ error: 'Invalid provider configuration format' });
    }

    // Check for token using different possible field names
    tokenValue = config.token || config.access_token;
    
    // If token not found directly, look in credentials object if it exists
    if (!tokenValue && config.credentials) {
      tokenValue = config.credentials.token || config.credentials.access_token;
      logger.info(`Found token in credentials object: ${!!tokenValue}`);
    }

    if (!tokenValue) {
      logger.error(`No token found in provider config for ${providerId}`, { 
        configKeys: Object.keys(config),
        configSample: JSON.stringify(config).substring(0, 100) + '...'
      });
      return res.status(400).json({ error: 'No access token found for this provider' });
    }
    
    logger.info(`Successfully extracted token for provider ${providerId}`);
    
    // Fetch account info and space usage in parallel
    const [accountInfo, spaceUsage] = await Promise.all([
      fetchDropboxAccountInfo(tokenValue),
      fetchDropboxSpaceUsage(tokenValue)
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