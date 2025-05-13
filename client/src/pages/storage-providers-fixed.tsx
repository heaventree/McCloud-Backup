import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { StorageProvider } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
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
} from "@/components/ui/alert-dialog";
import AddStorageForm from "@/components/storage/add-storage-form";
import { ProviderCard } from "@/components/storage/provider-card";
import { 
  Plus, 
  Search, 
  Loader2
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

  const handleSaveToken = () => {
    if (!providerNameInput.trim()) {
      toast({
        title: "Name required",
        description: "Please enter a name for this storage provider.",
        variant: "destructive"
      });
      return;
    }
    
    setIsProcessingToken(true);
    saveTokenMutation.mutate({
      provider: tokenProvider,
      name: providerNameInput,
      tokenData: tokenData
    });
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
          {filteredProviders.map((provider: StorageProvider) => (
            <ProviderCard 
              key={provider.id} 
              provider={provider} 
              onDelete={setProviderToDelete} 
            />
          ))}
        </div>
      )}

      {/* Confirmation Dialog for deletion */}
      {providerToDelete && (
        <AlertDialog 
          open={!!providerToDelete} 
          onOpenChange={(open) => !open && setProviderToDelete(null)}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove storage provider</AlertDialogTitle>
              <AlertDialogDescription>
                Are you sure you want to remove the <strong>{providerToDelete.name}</strong> storage provider? 
                This will not delete any of your backups, but you won't be able to back up to this location until you add it again.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => deleteMutation.mutate(providerToDelete.id)}
                disabled={deleteMutation.isPending}
                className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
              >
                {deleteMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Removing...
                  </>
                ) : (
                  "Remove"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* OAuth Token Processing Modal */}
      <Dialog open={showTokenModal} onOpenChange={setShowTokenModal}>
        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-gray-800 dark:text-gray-100">
              Complete {tokenProvider.charAt(0).toUpperCase() + tokenProvider.slice(1)} Integration
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Authentication successful! Enter a name for this storage provider to complete the setup.
            </p>
            <div className="space-y-2">
              <label htmlFor="providerName" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Provider Name
              </label>
              <Input
                id="providerName"
                placeholder={`My ${tokenProvider.charAt(0).toUpperCase() + tokenProvider.slice(1)} Account`}
                value={providerNameInput}
                onChange={(e) => setProviderNameInput(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowTokenModal(false);
                  setTokenData(null);
                  setTokenProvider('');
                  setProviderNameInput('');
                }}
                disabled={isProcessingToken}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSaveToken} 
                disabled={!providerNameInput.trim() || isProcessingToken}
              >
                {isProcessingToken ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StorageProviders;