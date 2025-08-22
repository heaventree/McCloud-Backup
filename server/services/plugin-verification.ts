import axios from 'axios';
import logger from '../utils/logger';

export interface PluginVerificationResult {
  success: boolean;
  error?: string;
}

export async function verifyWordPressPlugin(siteUrl: string): Promise<PluginVerificationResult> {
  try {
    // Ensure URL starts with http:// or https://
    let fullUrl = siteUrl;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      // Try HTTPS first, then HTTP if it fails
      fullUrl = `https://${siteUrl}`;
    }

    // Construct the plugin verification endpoint
    const verificationUrl = `${fullUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstart`;

    logger.info(`Verifying plugin for site: ${siteUrl}`, {
      verificationUrl,
      originalUrl: siteUrl
    });

    // Make POST request with empty payload as specified
    const response = await axios.post(verificationUrl, {}, {
      timeout: 15000, // 15 second timeout
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BackSheep-PluginVerification/1.0'
      },
      // Don't throw on 4xx/5xx responses, we'll handle them
      validateStatus: () => true
    });

    logger.info(`Plugin verification response for ${siteUrl}:`, {
      status: response.status,
      statusText: response.statusText,
      data: response.data
    });

    // Consider 200-299 status codes as successful plugin verification
    if (response.status >= 200 && response.status < 300) {
      logger.info(`Plugin verified successfully for site: ${siteUrl}`);
      return { success: true };
    }

    // If HTTPS failed and we tried HTTPS first, try HTTP
    if (fullUrl.startsWith('https://') && !siteUrl.startsWith('http')) {
      logger.info(`HTTPS verification failed for ${siteUrl}, trying HTTP...`);
      
      const httpUrl = fullUrl.replace('https://', 'http://');
      const httpVerificationUrl = `${httpUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstart`;
      
      const httpResponse = await axios.post(httpVerificationUrl, {}, {
        timeout: 15000,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'BackSheep-PluginVerification/1.0'
        },
        validateStatus: () => true
      });

      logger.info(`HTTP plugin verification response for ${siteUrl}:`, {
        status: httpResponse.status,
        statusText: httpResponse.statusText,
        data: httpResponse.data
      });

      if (httpResponse.status >= 200 && httpResponse.status < 300) {
        logger.info(`Plugin verified successfully via HTTP for site: ${siteUrl}`);
        return { success: true };
      }
    }

    logger.warn(`Plugin verification failed for site: ${siteUrl}`, {
      status: response.status,
      statusText: response.statusText
    });

    return {
      success: false,
      error: `Plugin verification failed. Status: ${response.status} ${response.statusText}. Please ensure the BackSheep plugin is installed and activated on your WordPress site.`
    };

  } catch (error) {
    logger.error(`Plugin verification error for site: ${siteUrl}`, {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });

    if (axios.isAxiosError(error)) {
      if (error.code === 'ENOTFOUND' || error.code === 'ECONNREFUSED') {
        return {
          success: false,
          error: `Cannot connect to site ${siteUrl}. Please check that the URL is correct and the site is accessible.`
        };
      }
      
      if (error.code === 'ETIMEDOUT') {
        return {
          success: false,
          error: `Connection timeout to ${siteUrl}. The site may be slow to respond or the plugin may not be installed.`
        };
      }
    }

    return {
      success: false,
      error: `Plugin verification failed: ${error instanceof Error ? error.message : 'Unknown error'}. Please ensure the BackSheep plugin is installed and activated.`
    };
  }
}