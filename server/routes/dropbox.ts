import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { fetchDropboxAccountInfo, fetchDropboxSpaceUsage, processDropboxToken } from '../providers/dropbox';
import prisma from '../prisma';
import { TokenRefreshManager } from '../TokenRefreshManager';

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
    const provider = await prisma.storageProvider.findUnique({
      where: { id: providerId }
    });
    
    if (!provider) {
      return res.status(404).json({ error: 'Storage provider not found' });
    }
    
    if (provider.type !== 'dropbox') {
      return res.status(400).json({ error: 'Storage provider is not a Dropbox provider' });
    }
    
    // Use new auto-refresh API wrapper that handles 401 errors automatically
    const tokenRefreshManager = TokenRefreshManager.getInstance();
    
    try {
      // Use makeDropboxApiCall to automatically handle token refresh on 401 errors
      const [accountInfo, spaceUsage] = await Promise.all([
        tokenRefreshManager.makeDropboxApiCall(providerId, (token) => fetchDropboxAccountInfo(token)),
        tokenRefreshManager.makeDropboxApiCall(providerId, (token) => fetchDropboxSpaceUsage(token))
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
      
      res.json(response);
      
    } catch (apiError) {
      // The makeDropboxApiCall wrapper already handles 401 errors and token refresh
      // If we get here, it means either token refresh failed or it's another type of error
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      
      if (errorMessage.includes('Token is invalid and could not be refreshed')) {
        return res.status(401).json({ 
          error: 'Authentication failed', 
          message: errorMessage
        });
      }
      
      // Other API errors
      throw apiError;
    }
    
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