/**
 * Simplified Backup Provider Registry
 * 
 * Direct access to backup providers with minimal abstraction.
 * This module provides a streamlined interface to available backup providers
 * without unnecessary complexity.
 */
import logger from '../utils/logger';
import { BackupProvider, BackupConfig } from './types';
import { githubBackupProviderFactory } from './github/factory';
import { retry } from '../utils/retryStrategy';

// Cache map for provider instances
const providerCache = new Map<string, BackupProvider>();

// Initialize and log available providers
logger.info('Registered provider: github');

/**
 * Get a provider instance with caching
 * 
 * @param config - Provider configuration
 * @returns Backup provider instance or undefined if provider not found
 */
export async function getProvider(config: BackupConfig): Promise<BackupProvider | undefined> {
  try {
    // Check if provider is already cached
    if (providerCache.has(config.id)) {
      return providerCache.get(config.id);
    }
    
    let provider: BackupProvider | undefined;
    
    // Direct provider mapping instead of factory lookup
    switch (config.provider) {
      case 'github':
        provider = githubBackupProviderFactory.createProvider(config);
        break;
        
      // Future providers can be added here
      // case 'dropbox':
      //   provider = dropboxBackupProviderFactory.createProvider(config);
      //   break;
        
      default:
        logger.error(`Provider type not found: ${config.provider}`);
        return undefined;
    }
    
    // Cache provider instance
    if (provider) {
      // Use retry utility to initialize the provider with resilience
      await retry(() => provider!.initialize(), {
        maxRetries: 3,
        initialDelay: 1000,
        onRetry: (error, attempt) => {
          logger.warn(`Retry initializing provider ${config.provider} (attempt ${attempt})`, { error });
        }
      });
      
      providerCache.set(config.id, provider);
    }
    
    return provider;
  } catch (error: unknown) {
    logger.error(`Error creating provider: ${config.provider}`, { error });
    return undefined;
  }
}

/**
 * Get available provider types
 * 
 * @returns List of provider information
 */
export function getAvailableProviders(): Array<{
  id: string;
  name: string;
  description: string;
  icon: string;
  features: Record<string, boolean>;
}> {
  // Directly return provider information without factory layer
  return [
    {
      id: 'github',
      name: 'GitHub',
      description: 'Backup to GitHub repository',
      icon: 'github',
      features: githubBackupProviderFactory.getInfo().features,
    },
    // Additional providers can be added here as they become available
  ];
}

/**
 * Get provider configuration fields
 * 
 * @param id - Provider ID
 * @returns Provider configuration fields
 */
export function getProviderConfigurationFields(id: string): Array<{
  name: string;
  type: 'text' | 'password' | 'number' | 'boolean' | 'select';
  label: string;
  placeholder?: string;
  required: boolean;
  options?: { value: string; label: string }[];
  defaultValue?: any;
  validation?: {
    pattern?: string;
    min?: number;
    max?: number;
    message?: string;
  };
}> | undefined {
  // Direct mapping to provider configuration fields
  switch (id) {
    case 'github':
      return githubBackupProviderFactory.getInfo().configFields;
      
    // Future providers can be added here
    
    default:
      return undefined;
  }
}

/**
 * Clear provider cache
 */
export function clearProviderCache(): void {
  providerCache.clear();
  logger.info('Provider cache cleared');
}

// Export functions directly instead of through a class
export default {
  getProvider,
  getAvailableProviders,
  getProviderConfigurationFields,
  clearCache: clearProviderCache
};