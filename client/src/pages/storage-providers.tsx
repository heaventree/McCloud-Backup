import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StorageProvider } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
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
  // Local state to force immediate UI updates
  const [forceRefresh, setForceRefresh] = useState(0);
  // For OAuth redirect handling
  const [location, setLocation] = useLocation();
  const [isProcessingToken, setIsProcessingToken] = useState(false);
  const [providerNameInput, setProviderNameInput] = useState("");
  
  // For OAuth token processing modal
  const [showTokenModal, setShowTokenModal] = useState(false);
  const [tokenData, setTokenData] = useState<any>(null);
  const [tokenProvider, setTokenProvider] = useState<string>("");

  const { data: storageProviders, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/storage-providers", forceRefresh], // Add forceRefresh as dependency
    // Ensure data refreshes frequently
    refetchOnWindowFocus: true,
    staleTime: 0, // Always get fresh data
  });

  const { data: backups } = useQuery({
    queryKey: ["/api/backups"],
    // Ensure data refreshes frequently
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000, // 10 seconds
  });
  
  // Mutation for saving tokens directly to database
  const saveTokenMutation = useMutation({
    mutationFn: async (data: { provider: string, name: string, tokenData: any }) => {
      const response = await apiRequest('POST', '/api/oauth-tokens/save', data);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate storage providers query to refresh the list
      queryClient.invalidateQueries({ queryKey: ['/api/storage-providers'] });
      setForceRefresh(prev => prev + 1);
      refetch();
      setShowTokenModal(false);
      setIsProcessingToken(false);
      
      toast({
        title: "Storage provider added",
        description: `Successfully added ${tokenProvider} storage provider`,
      });
    },
    onError: (error) => {
      console.error('Failed to save token:', error);
      toast({
        title: "Error adding storage provider",
        description: "Failed to save the storage provider. Please try again.",
        variant: "destructive"
      });
      setIsProcessingToken(false);
    }
  });
  
  // Detect token data from URL (from OAuth callback)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const encryptedTokenData = searchParams.get('token_data');
    const provider = searchParams.get('provider');
    
    if (encryptedTokenData && provider) {
      try {
        // Token data is present in the URL, show the modal to finalize the storage provider
        setTokenProvider(provider);
        setTokenData(encryptedTokenData);
        setShowTokenModal(true);
        
        // Clean up the URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } catch (error) {
        console.error('Error processing token data:', error);
        toast({
          title: "Authentication Error",
          description: "Failed to process authentication data. Please try again.",
          variant: "destructive"
        });
      }
    }
  }, [toast]);

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/storage-providers/${id}`);
    },
    onSuccess: () => {
      // Force immediate invalidation and refetch
      queryClient.invalidateQueries({
        queryKey: ["/api/storage-providers"],
        exact: false,
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/dashboard/stats"],
        exact: false,
        refetchType: "active",
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/backups"],
        exact: false,
        refetchType: "active",
      });
      
      // Force immediate refresh of the list
      setForceRefresh(prev => prev + 1);
      // Force refetch with a small delay to ensure DB has settled
      setTimeout(() => {
        refetch();
      }, 100);
      
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

  // Get icon for storage type
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

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
            Storage Providers
            <button 
              onClick={() => {
                setForceRefresh(prev => prev + 1);
                refetch();
                toast({
                  title: "Refreshed",
                  description: "Storage provider list has been refreshed",
                });
              }} 
              className="ml-2 p-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              title="Refresh the list"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </h1>
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
            <AddStorageForm onSuccess={() => {
              // Force refresh when storage provider is added
              setForceRefresh(prev => prev + 1);
              refetch();
              setIsAddingStorage(false);
            }} />
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
