/**
 * Backup Provider Registry
 * 
 * This module manages the registry of available backup providers
 * and handles provider initialization, lookup, and configuration.
 */
import { createLogger } from '../utils/logger';
import { BackupProviderFactory, BackupProvider, BackupConfig } from './types';
import { githubBackupProviderFactory } from './github/factory';

const logger = createLogger('provider-registry');

/**
 * Registry of backup provider factories
 */
class BackupProviderRegistry {
  private factories: Map<string, BackupProviderFactory>;
  private cachedProviders: Map<string, BackupProvider>;
  
  /**
   * Create a new backup provider registry
   */
  constructor() {
    this.factories = new Map();
    this.cachedProviders = new Map();
    
    // Register internal providers
    this.registerInternalProviders();
  }
  
  /**
   * Register internal backup providers
   */
  private registerInternalProviders(): void {
    // Register GitHub provider
    this.registerFactory(githubBackupProviderFactory);
    
    // Log registered providers
    const providerIds = Array.from(this.factories.keys());
    logger.info(`Registered internal providers: ${providerIds.join(', ')}`);
  }
  
  /**
   * Register a backup provider factory
   * 
   * @param factory - Backup provider factory
   * @returns True if registration was successful
   */
  registerFactory(factory: BackupProviderFactory): boolean {
    try {
      const id = factory.getId();
      
      if (this.factories.has(id)) {
        logger.warn(`Provider ${id} is already registered`);
        return false;
      }
      
      this.factories.set(id, factory);
      logger.info(`Registered provider: ${id}`);
      
      return true;
    } catch (error) {
      logger.error('Error registering provider factory', error);
      return false;
    }
  }
  
  /**
   * Unregister a backup provider factory
   * 
   * @param id - Provider ID
   * @returns True if unregistration was successful
   */
  unregisterFactory(id: string): boolean {
    try {
      if (!this.factories.has(id)) {
        logger.warn(`Provider ${id} is not registered`);
        return false;
      }
      
      // Remove from factories
      this.factories.delete(id);
      
      // Remove any cached providers
      this.cachedProviders.forEach((provider, key) => {
        if (provider.getId() === id) {
          this.cachedProviders.delete(key);
        }
      });
      
      logger.info(`Unregistered provider: ${id}`);
      
      return true;
    } catch (error) {
      logger.error(`Error unregistering provider: ${id}`, error);
      return false;
    }
  }
  
  /**
   * Get a backup provider factory
   * 
   * @param id - Provider ID
   * @returns Backup provider factory
   */
  getFactory(id: string): BackupProviderFactory | undefined {
    return this.factories.get(id);
  }
  
  /**
   * Get all registered provider factories
   * 
   * @returns List of provider factories
   */
  getAllFactories(): BackupProviderFactory[] {
    return Array.from(this.factories.values());
  }
  
  /**
   * Get a provider instance
   * 
   * @param config - Provider configuration
   * @returns Backup provider instance
   */
  getProvider(config: BackupConfig): BackupProvider | undefined {
    try {
      // Check if provider is already cached
      if (this.cachedProviders.has(config.id)) {
        return this.cachedProviders.get(config.id);
      }
      
      // Get factory for provider type
      const factory = this.factories.get(config.provider);
      
      if (!factory) {
        logger.error(`Provider type not found: ${config.provider}`);
        return undefined;
      }
      
      // Create provider instance
      const provider = factory.createProvider(config);
      
      // Cache provider instance
      this.cachedProviders.set(config.id, provider);
      
      return provider;
    } catch (error) {
      logger.error(`Error creating provider: ${config.provider}`, error);
      return undefined;
    }
  }
  
  /**
   * Get available provider types
   * 
   * @returns List of provider information
   */
  getAvailableProviders(): Array<{
    id: string;
    name: string;
    description: string;
    icon: string;
    features: Record<string, boolean>;
  }> {
    return Array.from(this.factories.values()).map(factory => {
      const info = factory.getInfo();
      
      return {
        id: info.id,
        name: info.name,
        description: info.description,
        icon: info.icon,
        features: info.features,
      };
    });
  }
  
  /**
   * Get provider configuration fields
   * 
   * @param id - Provider ID
   * @returns Provider configuration fields
   */
  getProviderConfigurationFields(id: string): Array<{
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
    const factory = this.factories.get(id);
    
    if (!factory) {
      return undefined;
    }
    
    return factory.getInfo().configFields;
  }
  
  /**
   * Initialize all cached providers
   * 
   * @returns Promise that resolves when all providers are initialized
   */
  async initializeAllProviders(): Promise<void> {
    const initPromises = Array.from(this.cachedProviders.values()).map(
      provider => provider.initialize()
    );
    
    await Promise.all(initPromises);
  }
  
  /**
   * Clear provider cache
   */
  clearCache(): void {
    this.cachedProviders.clear();
  }
}

// Create singleton instance
export const providerRegistry = new BackupProviderRegistry();

export default providerRegistry;