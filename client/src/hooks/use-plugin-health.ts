import { useQuery } from '@tanstack/react-query';

export interface PluginHealthStatus {
  available: boolean;
  status: 'active' | 'inactive' | 'not_installed' | 'timeout' | 'error';
  version?: string;
  message: string;
  endpoints_available: boolean;
  last_checked: string;
  error_details?: {
    code?: string;
    status?: number;
  };
}

export function usePluginHealth(siteId: number | null, enabled: boolean = true) {
  return useQuery({
    queryKey: ['/api/sites', siteId, 'plugin-status'],
    enabled: enabled && siteId !== null,
    staleTime: 2 * 60 * 1000, // 2 minutes - plugin status doesn't change frequently
    gcTime: 5 * 60 * 1000, // 5 minutes cache time
    retry: 2,
    retryDelay: 1000,
  });
}

export function usePluginHealthCheck(siteId: number | null) {
  const query = usePluginHealth(siteId);
  
  const data = query.data as PluginHealthStatus | undefined;
  const isPluginAvailable = data?.available === true;
  const isPluginReady = isPluginAvailable && data?.endpoints_available === true;
  const pluginStatus = data?.status;
  const errorMessage = data?.message;
  
  return {
    ...query,
    data,
    isPluginAvailable,
    isPluginReady,
    pluginStatus,
    errorMessage,
    isChecking: query.isLoading,
  };
}