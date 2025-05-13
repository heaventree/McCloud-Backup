import { useQuery } from '@tanstack/react-query';
import axios from 'axios';
import { StorageProvider } from '@/lib/types';
import { useToast } from './use-toast';

/**
 * Custom hook to fetch extended provider data for supported providers (Dropbox, etc.)
 */
export function useProviderData(provider: StorageProvider | undefined) {
  const { toast } = useToast();
  
  return useQuery({
    queryKey: ['providerData', provider?.id],
    queryFn: async () => {
      if (!provider) return null;
      
      try {
        // Currently only supporting Dropbox
        if (provider.type === 'dropbox') {
          const response = await axios.get(`/api/dropbox/provider/${provider.id}`);
          return response.data;
        }
        
        // Return null for unsupported provider types
        return null;
      } catch (error) {
        if (axios.isAxiosError(error)) {
          toast({
            title: 'Error fetching provider data',
            description: error.response?.data?.message || error.message,
            variant: 'destructive',
          });
        } else {
          toast({
            title: 'Unknown error',
            description: 'Failed to fetch provider data',
            variant: 'destructive',
          });
        }
        throw error;
      }
    },
    enabled: !!provider && provider.type === 'dropbox',
    refetchOnWindowFocus: false,
  });
}