import React, { useEffect, useState } from 'react';
import { Loader2, Edit, Trash } from 'lucide-react';
import { StorageProvider } from '@/lib/types';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SvglIcon } from '@/components/ui/svgl-icon';
import { useToast } from '@/hooks/use-toast';
import { formatDistanceToNow } from 'date-fns';

interface DropboxProviderCardProps {
  provider: StorageProvider;
  onDelete: (provider: StorageProvider) => void;
}

interface ProviderDetails {
  used: number;
  quota: number;
  accountInfo: {
    name: string;
    email: string;
    accountType: string;
  };
}

export function DropboxProviderCard({ provider, onDelete }: DropboxProviderCardProps) {
  const { toast } = useToast();
  const [providerDetails, setProviderDetails] = useState<ProviderDetails | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Helper functions
  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === 0) return "0 B";
    
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  const calculatePercentage = (used: number, quota: number | undefined | null) => {
    if (!quota) return 0;
    return Math.min(Math.round((used / quota) * 100), 100);
  };

  // Fetch provider details
  useEffect(() => {
    const fetchProviderDetails = async () => {
      if (provider.type !== 'dropbox') return;
      
      try {
        setIsLoading(true);
        
        const response = await fetch(`/api/dropbox/provider/${provider.id}`);
        if (!response.ok) {
          throw new Error(`Error fetching Dropbox data: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        setProviderDetails({
          used: data.spaceUsage.used,
          quota: data.spaceUsage.allocated,
          accountInfo: {
            name: data.accountInfo.name.display_name,
            email: data.accountInfo.email,
            accountType: data.accountInfo.accountType
          }
        });
      } catch (error) {
        console.error(`Error fetching details for provider ${provider.id}:`, error);
        toast({
          title: "Error fetching provider data",
          description: error instanceof Error ? error.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProviderDetails();
  }, [provider.id, provider.type, toast]);

  // Calculate usage
  const used = providerDetails?.used || provider.used || 0;
  const quota = providerDetails?.quota || provider.quota || 0;
  const percentage = calculatePercentage(used, quota);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md overflow-hidden shadow border border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <div className="px-4 py-4 flex-grow">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400">
            <SvglIcon slug="dropbox" width={20} height={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{provider.name}</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Dropbox
            </div>
          </div>
        </div>
        
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Storage Usage</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {isLoading ? (
                  <Loader2 className="h-3 w-3 inline animate-spin mr-1" />
                ) : (
                  <>
                    {formatSize(used)}
                    {quota ? ` / ${formatSize(quota)}` : ""}
                  </>
                )}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
              <div 
                className={`h-full ${
                  percentage > 90 
                    ? "bg-red-500" 
                    : percentage > 70 
                      ? "bg-yellow-500" 
                      : "bg-green-500"
                }`}
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
            <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-500">
              <span>Dropbox Storage</span>
              <span>{percentage}% used</span>
            </div>
          </div>
          
          {/* Account information section */}
          <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
            {isLoading ? (
              <div className="flex items-center text-gray-500 text-sm">
                <Loader2 className="h-3 w-3 inline animate-spin mr-2" />
                Loading account info...
              </div>
            ) : providerDetails?.accountInfo ? (
              <div className="space-y-1">
                <div className="text-gray-600 dark:text-gray-300 font-medium text-sm">
                  {providerDetails.accountInfo.name}
                </div>
                <div className="text-gray-500 dark:text-gray-500 text-xs">
                  {providerDetails.accountInfo.email}
                </div>
                <div className="text-gray-500 dark:text-gray-500 text-xs">
                  Account type: {providerDetails.accountInfo.accountType?.charAt(0).toUpperCase() + 
                    providerDetails.accountInfo.accountType?.slice(1)}
                </div>
              </div>
            ) : null}
          </div>
          
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Added:</span>
              <span className="text-gray-700 dark:text-gray-300">{formatDistanceToNow(new Date(provider.createdAt), { addSuffix: true })}</span>
            </div>
          </div>
        </div>
      </div>
      
      <div className="mt-auto">
        <div className="border-t border-gray-200 dark:border-gray-700"></div>
        
        <div className="px-4 py-3 flex justify-between">
          <button className="flex items-center px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-200 text-sm font-medium rounded-md transition-colors">
            <Edit className="mr-1 h-4 w-4" />
            Edit
          </button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button 
                className="flex items-center px-4 py-2 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 text-sm font-medium rounded-md transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  onDelete(provider);
                }}
              >
                <Trash className="mr-1 h-4 w-4" />
                Remove
              </button>
            </AlertDialogTrigger>
          </AlertDialog>
        </div>
      </div>
    </div>
  );
}