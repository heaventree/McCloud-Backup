import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StorageProvider } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardFooter, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import AddStorageForm from "@/components/storage/add-storage-form";
import { formatDistanceToNow } from "date-fns";
import { SvglIcon } from "@/components/ui/svgl-icon";
import { 
  Plus, 
  Search, 
  Loader2, 
  Cloud, 
  Edit, 
  Trash,
  HardDrive,
  Database
} from "lucide-react";

const StorageProviders = () => {
  const { toast } = useToast();
  const [isAddingStorage, setIsAddingStorage] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [providerToDelete, setProviderToDelete] = useState<StorageProvider | null>(null);

  const { data: storageProviders, isLoading, isError } = useQuery({
    queryKey: ["/api/storage-providers"],
  });

  const { data: backups } = useQuery({
    queryKey: ["/api/backups"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/storage-providers/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/storage-providers"] });
      toast({
        title: "Storage provider deleted",
        description: "The storage provider has been removed successfully",
      });
      setProviderToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting storage provider",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Filter providers based on search term
  const filteredProviders = storageProviders && Array.isArray(storageProviders) 
    ? storageProviders.filter((provider: StorageProvider) => 
      provider.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      provider.type.toLowerCase().includes(searchTerm.toLowerCase())
    ) 
    : [];

  // Calculate storage usage
  const calculateUsage = (providerId: number) => {
    if (!backups || !Array.isArray(backups)) return { usedBytes: 0, backupCount: 0 };
    
    let totalSize = 0;
    let count = 0;
    
    backups.forEach((backup: any) => {
      if (backup.storageProviderId === providerId && backup.status === "completed" && backup.size) {
        totalSize += backup.size;
        count++;
      }
    });
    
    return {
      usedBytes: totalSize,
      backupCount: count,
    };
  };

  // Format the size to human-readable format
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

  // Calculate usage percentage
  const calculatePercentage = (used: number, quota: number | null) => {
    if (!quota) return 0;
    return Math.min(Math.round((used / quota) * 100), 100);
  };

  // Get storage type display name
  const getStorageTypeDisplay = (type: string) => {
    switch (type) {
      case "google_drive":
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
      default:
        return type.charAt(0).toUpperCase() + type.slice(1).replace(/_/g, ' ');
    }
  };

  // Get icon for storage type
  const getStorageTypeIcon = (type: string) => {
    switch (type) {
      case "google_drive":
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
      default:
        return <Cloud className="h-5 w-5" />;
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Storage Providers</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your backup storage destinations</p>
        </div>
        <Dialog open={isAddingStorage} onOpenChange={setIsAddingStorage}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-1 h-4 w-4" />
              Add Storage Provider
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <DialogHeader>
              <DialogTitle className="text-gray-800 dark:text-gray-100">Add Storage Provider</DialogTitle>
            </DialogHeader>
            <AddStorageForm onSuccess={() => setIsAddingStorage(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            placeholder="Search storage providers..."
            className="pl-8 w-full h-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-400">
          Failed to load storage providers
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchTerm ? "No storage providers match your search" : "No storage providers added yet"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredProviders.map((provider: StorageProvider) => {
            const usage = calculateUsage(provider.id);
            const percentage = calculatePercentage(usage.usedBytes, provider.quota);
            
            return (
              <div key={provider.id} className="bg-white dark:bg-gray-800 rounded-md overflow-hidden shadow border border-gray-200 dark:border-gray-700 flex flex-col h-full">
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
                          {formatSize(usage.usedBytes)}
                          {provider.quota ? ` / ${formatSize(provider.quota)}` : ""}
                        </span>
                      </div>
                      <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-blue-600 rounded-full" 
                          style={{ width: `${percentage}%` }}
                        ></div>
                      </div>
                      <div className="mt-1 flex justify-between text-xs text-gray-500 dark:text-gray-500">
                        <span>{usage.backupCount} {usage.backupCount === 1 ? 'backup' : 'backups'}</span>
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
                      {provider.type === 's3' && (
                        <div className="flex justify-between">
                          <span className="text-gray-500 dark:text-gray-400">Bucket:</span>
                          <span className="truncate max-w-[150px] text-gray-700 dark:text-gray-300">{provider.credentials.bucket}</span>
                        </div>
                      )}
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
                    <AlertDialog open={providerToDelete?.id === provider.id} onOpenChange={(open) => !open && setProviderToDelete(null)}>
                      <AlertDialogTrigger asChild>
                        <button 
                          className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-red-500 dark:text-red-400 hover:text-red-600 dark:hover:text-red-300 transition-colors"
                          onClick={() => setProviderToDelete(provider)}
                        >
                          <Trash className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                        <AlertDialogHeader>
                          <AlertDialogTitle className="text-gray-800 dark:text-gray-100">Delete Storage Provider</AlertDialogTitle>
                          <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
                            Are you sure you want to delete "{provider.name}"? This action cannot be undone. All backups stored with this provider will be inaccessible.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</AlertDialogCancel>
                          <AlertDialogAction 
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={() => deleteMutation.mutate(provider.id)}
                            disabled={deleteMutation.isPending}
                          >
                            {deleteMutation.isPending ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Deleting...
                              </>
                            ) : (
                              "Delete"
                            )}
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StorageProviders;
