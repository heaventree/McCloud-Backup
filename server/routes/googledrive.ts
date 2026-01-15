import { Router, Request, Response } from 'express';
import logger from '../utils/logger';
import { fetchGoogleDriveAccountInfo, fetchGoogleDriveSpaceUsage, processGoogleDriveToken } from '../providers/googledrive';
import prisma from '../prisma';
import { TokenRefreshManager } from '../TokenRefreshManager';

const router = Router();

router.get('/provider/:id', async (req: Request, res: Response) => {
  const providerId = parseInt(req.params.id);
  
  if (isNaN(providerId)) {
    return res.status(400).json({ error: 'Invalid provider ID' });
  }
  
  try {
    const provider = await prisma.storageProvider.findUnique({
      where: { id: providerId }
    });
    
    if (!provider) {
      return res.status(404).json({ error: 'Storage provider not found' });
    }
    
    if (provider.type !== 'googledrive') {
      return res.status(400).json({ error: 'Storage provider is not a Google Drive provider' });
    }
    
    const tokenRefreshManager = TokenRefreshManager.getInstance();
    
    try {
      const [accountInfo, spaceUsage] = await Promise.all([
        tokenRefreshManager.makeGoogleDriveApiCall(providerId, (token) => fetchGoogleDriveAccountInfo(token)),
        tokenRefreshManager.makeGoogleDriveApiCall(providerId, (token) => fetchGoogleDriveSpaceUsage(token))
      ]);
    
      const response = {
        accountInfo: {
          name: accountInfo.name || 'Unknown',
          email: accountInfo.email || 'Unknown',
          picture: accountInfo.picture || null,
        },
        spaceUsage: {
          used: spaceUsage.used,
          allocated: spaceUsage.allocation.allocated
        }
      };
      
      res.json(response);
      
    } catch (apiError) {
      const errorMessage = apiError instanceof Error ? apiError.message : 'Unknown error';
      
      if (errorMessage.includes('Token is invalid and could not be refreshed')) {
        return res.status(401).json({ 
          error: 'Authentication failed', 
          message: errorMessage
        });
      }
      
      throw apiError;
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`Failed to fetch Google Drive data for provider ${providerId}:`, error);
    res.status(500).json({ 
      error: 'Failed to fetch Google Drive data',
      message: errorMessage
    });
  }
});

export default router;
