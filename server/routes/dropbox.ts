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
    

    
    // Use TokenRefreshManager to get a valid access token (will refresh if needed)
    const tokenRefreshManager = TokenRefreshManager.getInstance();
    const tokenResult = await tokenRefreshManager.getValidAccessToken(providerId);
    
    if (!tokenResult.success) {
      logger.error(`Failed to get valid access token for provider ${providerId}: ${tokenResult.error}`);
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: tokenResult.error
      });
    }
    
    const validToken = tokenResult.access_token!;
    
    try {
      // Fetch account info and space usage in parallel using the valid token
      const [accountInfo, spaceUsage] = await Promise.all([
        fetchDropboxAccountInfo(validToken),
        fetchDropboxSpaceUsage(validToken)
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
      // Check if this is a 401 error (token still invalid after refresh attempt)
      if (apiError instanceof Error && apiError.message.includes('401')) {
        logger.error(`Dropbox API returned 401 even after token refresh for provider ${providerId}`);
        return res.status(401).json({ 
          error: 'Authentication failed', 
          message: 'Token is invalid and could not be refreshed. Please re-authenticate.'
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