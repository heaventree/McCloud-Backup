import axios from 'axios';
import logger from '../utils/logger';

export interface PluginVerificationResult {
  success: boolean;
  error?: string;
}

/**
 * Verify a WordPress site's plugin is installed, active, and configured with the API key on
 * file - via the v3 REST namespace's /validate route.
 *
 * The old backsheep/v1/backup/verify-plugin route (and its `status: "SUCCESS"` + `token`
 * response contract) never existed in v3 - it was missed during the v1->v3 migration and 404s
 * against every live site. /validate is the closest real replacement: it's a GET route gated
 * by the same check_api_permission() the api_key already has to satisfy, and returns
 * `status: "success"` (lowercase) plus plugin/version info - there's no token field to compare
 * because the api_key itself IS the auth here, sent as a query param and checked server-side
 * before validate_api() ever runs (wrong/missing key never reaches 2xx). /site/health-check was
 * the other v3 candidate, but its registered callback - McCloudBackup::run_health_check() -
 * isn't defined on that class in the current plugin source (confirmed by reading
 * backupsheep.php), so it 500s; /validate is also just the more direct match for "is this
 * plugin installed and this key valid" anyway.
 */
export async function verifyWordPressPlugin(siteUrl: string, apiKey?: string): Promise<PluginVerificationResult> {
  try {
    // Ensure URL starts with http:// or https://
    let fullUrl = siteUrl;
    if (!fullUrl.startsWith('http://') && !fullUrl.startsWith('https://')) {
      // Try HTTPS first, then HTTP if it fails
      fullUrl = `https://${siteUrl}`;
    }

    // /validate is a GET route; check_api_permission() reads the key via
    // $request->get_param('api_key'), which for GET comes off the query string - not a POST
    // body - so the key has to travel as a query param, not JSON payload.
    const buildVerificationUrl = (base: string) => {
      const params = new URLSearchParams({ rest_route: '/backupsheep/v3/validate' });
      if (apiKey) {
        params.set('api_key', apiKey);
      }
      return `${base}/index.php?${params.toString()}`;
    };

    const verificationUrl = buildVerificationUrl(fullUrl);

    logger.info(`Verifying plugin for site: ${siteUrl}`, {
      verificationUrl,
      originalUrl: siteUrl
    });

    const response = await axios.get(verificationUrl, {
      timeout: 15000, // 15 second timeout
      headers: {
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

    // Consider 200-299 status codes as successful plugin verification. The api_key was already
    // checked server-side (check_api_permission) before validate_api() ran - a wrong or missing
    // key never reaches 2xx - so all that's left to confirm here is the response actually came
    // from the plugin's /validate handler and not some unrelated 200 (e.g. a caching/proxy page).
    if (response.status >= 200 && response.status < 300) {
      const responseData = response.data;

      if (!responseData || responseData.status !== 'success') {
        logger.warn(`Plugin responded successfully but with invalid format for ${siteUrl}:`, {
          status: responseData?.status
        });
        return {
          success: false,
          error: 'Plugin responded but with invalid format. Expected status "success" from /validate.'
        };
      }

      logger.info(`Plugin and API key verified successfully for site: ${siteUrl}`);
      return { success: true };
    }

    // If HTTPS failed and we tried HTTPS first, try HTTP
    if (fullUrl.startsWith('https://') && !siteUrl.startsWith('http')) {
      logger.info(`HTTPS verification failed for ${siteUrl}, trying HTTP...`);

      const httpUrl = fullUrl.replace('https://', 'http://');
      const httpVerificationUrl = buildVerificationUrl(httpUrl);

      const httpResponse = await axios.get(httpVerificationUrl, {
        timeout: 15000,
        headers: {
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
        const responseData = httpResponse.data;

        if (!responseData || responseData.status !== 'success') {
          logger.warn(`Plugin (HTTP) responded successfully but with invalid format for ${siteUrl}:`, {
            status: responseData?.status
          });
          return {
            success: false,
            error: 'Plugin responded via HTTP but with invalid format. Expected status "success" from /validate.'
          };
        }

        logger.info(`Plugin and API key verified successfully via HTTP for site: ${siteUrl}`);
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