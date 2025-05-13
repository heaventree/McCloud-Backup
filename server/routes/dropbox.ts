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
    
    // First parse the JSON from the database
    try {
      config = JSON.parse(rawConfig);
      logger.info(`Successfully parsed JSON config for provider ${providerId}, keys: ${Object.keys(config).join(', ')}`);
    } catch (parseError) {
      const errorMessage = parseError instanceof Error ? parseError.message : 'Unknown error';
      logger.error(`Failed to parse config JSON: ${errorMessage}`);
      return res.status(400).json({ error: 'Invalid provider configuration format' });
    }

    // Extract the token from the config object
    tokenValue = config.token || config.access_token;
    
    // If token not found directly, look in credentials object if it exists
    if (!tokenValue && config.credentials) {
      tokenValue = config.credentials.token || config.credentials.access_token;
      logger.info(`Found token in credentials object: ${!!tokenValue}`);
    }
    
    // If tokenValue is a HTML-encoded JSON string (like in the format you provided),
    // we need to decode it and parse it to get the actual token
    if (tokenValue && typeof tokenValue === 'string' && 
        (tokenValue.includes('&quot;') || tokenValue.includes('access_token'))) {
      try {
        // First decode HTML entities if needed
        let decodedValue = tokenValue
          .replace(/&quot;/g, '"') // Replace &quot; with "
          .replace(/&amp;/g, '&')  // Replace &amp; with &
          .replace(/&#39;/g, "'")  // Replace &#39; with '
          .replace(/&lt;/g, '<')   // Replace &lt; with <
          .replace(/&gt;/g, '>')   // Replace &gt; with >
        
        logger.info(`Decoded HTML entities in token, now length: ${decodedValue.length}`);
        
        // Try to parse as JSON
        const parsedToken = JSON.parse(decodedValue);
        logger.info(`Successfully parsed token JSON with keys: ${Object.keys(parsedToken).join(', ')}`);
        
        // Extract the access_token from the parsed JSON
        if (parsedToken.access_token) {
          logger.info(`Found access_token in parsed token JSON`);
          tokenValue = parsedToken.access_token;
        }
      } catch (error) {
        // If parsing fails, continue with the token as-is
        logger.warn(`Failed to parse token as JSON: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    if (!tokenValue) {
      logger.error(`No token found in provider config for ${providerId}`, { 
        configKeys: Object.keys(config),
        configSample: JSON.stringify(config).substring(0, 100) + '...'
      });
      return res.status(400).json({ error: 'No access token found for this provider' });
    }
    
    logger.info(`Found token for provider ${providerId}, length: ${tokenValue.length}`);
    
    // No more decryption - we're storing tokens as plain text
    logger.info(`Using token as-is for provider ${providerId}`)
    
    logger.info(`Using token for Dropbox API calls, provider ${providerId}`);
    
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