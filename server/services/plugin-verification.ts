import axios from 'axios';
import logger from '../utils/logger';

export interface PluginVerificationResult {
  success: boolean;
  error?: string;
}

export async function verifyWordPressPlugin(siteUrl: string, apiKey?: string): Promise<PluginVerificationResult> {
  try {
    // Ensure URL starts with http:// or https://
    let fullUrl = siteUrl;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      // Try HTTPS first, then HTTP if it fails
      fullUrl = `https://${siteUrl}`;
    }

    // Construct the plugin verification endpoint
    const verificationUrl = `${fullUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fverify-plugin`;

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
      // If apiKey is provided, verify it matches the token in the response
      if (apiKey) {
        const responseData = response.data;
        
        // Check if the response has the expected format
        if (!responseData || responseData.status !== 'SUCCESS' || !responseData.token) {
          logger.warn(`Plugin responded successfully but with invalid format for ${siteUrl}:`, {
            status: responseData?.status,
            hasToken: !!responseData?.token
          });
          return {
            success: false,
            error: 'Plugin responded but with invalid format. Expected status "SUCCESS" and a token field.'
          };
        }
        
        // Verify the token matches the site's API key
        if (responseData.token !== apiKey) {
          logger.warn(`Plugin API key verification failed for ${siteUrl}:`, {
            tokenReceived: !!responseData.token,
            apiKeyProvided: !!apiKey
          });
          return {
            success: false,
            error: 'Plugin verification failed. The API key from the plugin does not match the configured site API key.'
          };
        }
        
        logger.info(`Plugin and API key verified successfully for site: ${siteUrl}`);
        return { success: true };
      } else {
        // No API key provided, just verify endpoint availability
        logger.info(`Plugin endpoint verified successfully for site: ${siteUrl}`);
        return { success: true };
      }
    }

    // If HTTPS failed and we tried HTTPS first, try HTTP
    if (fullUrl.startsWith('https://') && !siteUrl.startsWith('http')) {
      logger.info(`HTTPS verification failed for ${siteUrl}, trying HTTP...`);
      
      const httpUrl = fullUrl.replace('https://', 'http://');
      const httpVerificationUrl = `${httpUrl}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fverify-plugin`;
      
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
        // If apiKey is provided, verify it matches the token in the HTTP response
        if (apiKey) {
          const responseData = httpResponse.data;
          
          // Check if the response has the expected format
          if (!responseData || responseData.status !== 'SUCCESS' || !responseData.token) {
            logger.warn(`Plugin (HTTP) responded successfully but with invalid format for ${siteUrl}:`, {
              status: responseData?.status,
              hasToken: !!responseData?.token
            });
            return {
              success: false,
              error: 'Plugin responded via HTTP but with invalid format. Expected status "SUCCESS" and a token field.'
            };
          }
          
          // Verify the token matches the site's API key
          if (responseData.token !== apiKey) {
            logger.warn(`Plugin API key verification failed via HTTP for ${siteUrl}:`, {
              tokenReceived: !!responseData.token,
              apiKeyProvided: !!apiKey
            });
            return {
              success: false,
              error: 'Plugin verification failed via HTTP. The API key from the plugin does not match the configured site API key.'
            };
          }
          
          logger.info(`Plugin and API key verified successfully via HTTP for site: ${siteUrl}`);
          return { success: true };
        } else {
          // No API key provided, just verify endpoint availability
          logger.info(`Plugin endpoint verified successfully via HTTP for site: ${siteUrl}`);
          return { success: true };
        }
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