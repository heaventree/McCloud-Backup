import React from 'react';
import { StorageProvider } from '@/lib/types';
import { DropboxProviderCard } from './dropbox-provider-card';
import { Loader2, Edit, Trash, Cloud } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { Progress } from '@/components/ui/progress';
import { AlertDialog, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { SvglIcon } from '@/components/ui/svgl-icon';

interface ProviderCardProps {
  provider: StorageProvider;
  onDelete: (provider: StorageProvider) => void;
}

/**
 * A factory component that renders the appropriate provider card based on the provider type
 */
export function ProviderCard({ provider, onDelete }: ProviderCardProps) {
  // Return type-specific card for supported providers
  if (provider.type === 'dropbox') {
    return <DropboxProviderCard provider={provider} onDelete={onDelete} />;
  }
  
  // Return a generic card for unsupported provider types
  return <GenericProviderCard provider={provider} onDelete={onDelete} />;
}

/**
 * A generic provider card for unsupported provider types
 */
function GenericProviderCard({ provider, onDelete }: ProviderCardProps) {
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

  const getStorageTypeDisplay = (type: string) => {
    switch (type) {
      case "google":
        return "Google Drive";
      case "dropbox":
        return "Dropbox";
      case "s3":
        return "Amazon S3";
      case "onedrive":
        return "Microsoft OneDrive";
      case "ftp":
        return "FTP Server";
      case "local":
        return "Local Storage";
      case "github":
        return "GitHub";
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
    }
  };

  const getStorageTypeIcon = (type: string) => {
    switch (type) {
      case "google":
        return <SvglIcon slug="google-drive" width={20} height={20} />;
      case "dropbox":
        return <SvglIcon slug="dropbox" width={20} height={20} />;
      case "s3":
        return <SvglIcon slug="aws" width={20} height={20} />;
      case "ftp":
        return <SvglIcon slug="server" width={20} height={20} />;
      case "local":
        return <SvglIcon slug="folder" width={20} height={20} />;
      case "onedrive":
        return <SvglIcon slug="onedrive" width={20} height={20} />;
      case "github":
        return <SvglIcon slug="github" width={20} height={20} />;
      default:
        return <Cloud className="h-5 w-5" />;
    }
  };

  // Calculate usage
  const percentage = calculatePercentage(provider.used || 0, provider.quota);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-md overflow-hidden shadow border border-gray-200 dark:border-gray-700 flex flex-col h-full">
      <div className="px-4 py-4 flex-grow">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400">
            {getStorageTypeIcon(provider.type)}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{provider.name}</h3>
            <div className="text-sm text-gray-500 dark:text-gray-400">
              {getStorageTypeDisplay(provider.type)}
            </div>
          </div>
        </div>
        
        <div className="mt-4 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500 dark:text-gray-400">Storage Usage</span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {formatSize(provider.used || 0)}
                {provider.quota ? ` / ${formatSize(provider.quota)}` : ""}
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
              <span>Storage</span>
              <span>{percentage}% used</span>
            </div>
          </div>
          
          <div className="text-sm space-y-2">
            <div className="flex justify-between">
              <span className="text-gray-500 dark:text-gray-400">Type:</span>
              <span className="text-gray-700 dark:text-gray-300">{getStorageTypeDisplay(provider.type)}</span>
            </div>
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