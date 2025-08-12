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
  
  logger.info(`[DEBUG] /provider/:id endpoint called with providerId: ${providerId}`);
  
  if (isNaN(providerId)) {
    logger.error(`[DEBUG] Invalid provider ID received: ${req.params.id}`);
    return res.status(400).json({ error: 'Invalid provider ID' });
  }
  
  try {
    // Get the storage provider from the database
    logger.info(`[DEBUG] Fetching storage provider from database for ID: ${providerId}`);
    const provider = await prisma.storageProvider.findUnique({
      where: { id: providerId }
    });
    
    if (!provider) {
      logger.error(`[DEBUG] Storage provider not found for ID: ${providerId}`);
      return res.status(404).json({ error: 'Storage provider not found' });
    }
    
    logger.info(`[DEBUG] Found provider:`, {
      id: provider.id,
      type: provider.type,
      userId: provider.userId,
      configLength: provider.config.length
    });
    
    if (provider.type !== 'dropbox') {
      logger.error(`[DEBUG] Provider type mismatch. Expected 'dropbox', got '${provider.type}'`);
      return res.status(400).json({ error: 'Storage provider is not a Dropbox provider' });
    }
    
    logger.info(`[DEBUG] Provider validation passed. Starting token refresh process...`);
    
    // Use TokenRefreshManager to get a valid access token (will refresh if needed)
    const tokenRefreshManager = TokenRefreshManager.getInstance();
    logger.info(`[DEBUG] TokenRefreshManager instance obtained. Calling getValidAccessToken...`);
    const tokenResult = await tokenRefreshManager.getValidAccessToken(providerId);
    
    logger.info(`[DEBUG] Token refresh result:`, {
      success: tokenResult.success,
      hasAccessToken: !!tokenResult.access_token,
      tokenLength: tokenResult.access_token?.length || 0,
      error: tokenResult.error
    });
    
    if (!tokenResult.success) {
      logger.error(`[DEBUG] Failed to get valid access token for provider ${providerId}: ${tokenResult.error}`);
      return res.status(401).json({ 
        error: 'Authentication failed',
        message: tokenResult.error
      });
    }
    
    const validToken = tokenResult.access_token!;
    logger.info(`[DEBUG] Valid token obtained. Token prefix: ${validToken.substring(0, 20)}...`);
    
    try {
      logger.info(`[DEBUG] Making parallel API calls to Dropbox with token...`);
      // Fetch account info and space usage in parallel using the valid token
      const [accountInfo, spaceUsage] = await Promise.all([
        fetchDropboxAccountInfo(validToken),
        fetchDropboxSpaceUsage(validToken)
      ]);
      
      logger.info(`[DEBUG] Dropbox API calls successful. Account: ${accountInfo.email}, Used space: ${spaceUsage.used}`);
    
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
      
      logger.info(`[DEBUG] Sending successful response for provider ${providerId}`);
      res.json(response);
      
    } catch (apiError) {
      logger.error(`[DEBUG] Dropbox API error occurred:`, {
        error: apiError,
        message: apiError instanceof Error ? apiError.message : 'Unknown error',
        stack: apiError instanceof Error ? apiError.stack : undefined
      });
      
      // Check if this is a 401 error (token still invalid after refresh attempt)
      if (apiError instanceof Error && apiError.message.includes('401')) {
        logger.error(`[DEBUG] Dropbox API returned 401 even after token refresh for provider ${providerId}`);
        return res.status(401).json({ 
          error: 'Authentication failed', 
          message: 'Token is invalid and could not be refreshed. Please re-authenticate.'
        });
      }
      
      // Other API errors
      logger.error(`[DEBUG] Non-401 API error, rethrowing...`);
      throw apiError;
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`[DEBUG] Outer catch block - Failed to fetch Dropbox data for provider ${providerId}:`, {
      error,
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined
    });
    res.status(500).json({ 
      error: 'Failed to fetch Dropbox data',
      message: errorMessage
    });
  }
});

export default router;