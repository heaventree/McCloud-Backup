import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Github, Clock, ExternalLink, Download, Trash, Users } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { StorageProvider, Backup } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";

type GitHubRepoListProps = {
  onSelect?: (repo: StorageProvider) => void;
};

export default function GitHubRepoList({ onSelect }: GitHubRepoListProps) {
  const { toast } = useToast();
  const [repoToDelete, setRepoToDelete] = useState<StorageProvider | null>(null);
  
  // Fetch storage providers
  const { data: storageProviders, isLoading, isError } = useQuery({
    queryKey: ["/api/storage-providers"],
  });
  
  // Fetch latest backups for each provider
  const { data: backups } = useQuery({
    queryKey: ["/api/backups"],
  });
  
  // Filter only GitHub storage providers
  const gitHubProviders = storageProviders && Array.isArray(storageProviders)
    ? storageProviders.filter((provider: StorageProvider) => provider.type === "github")
    : [];
  
  // Function to get the last backup for a provider
  const getLastBackupForProvider = (providerId: number) => {
    if (!backups || !Array.isArray(backups)) return null;
    
    return backups
      .filter((backup: Backup) => backup.storageProviderId === providerId)
      .sort((a: Backup, b: Backup) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      )[0];
  };
  
  // Function to get repo name from provider
  const getRepoName = (provider: StorageProvider) => {
    if (!provider.credentials) return "Unknown Repository";
    
    // Extract repo name from credentials
    if (provider.credentials.username && provider.credentials.path) {
      return `${provider.credentials.username}/${provider.credentials.path.split('/').pop()}`;
    }
    
    return provider.name || "Unnamed Repository";
  };
  
  // Function to get repo URL
  const getRepoUrl = (provider: StorageProvider) => {
    if (!provider.credentials) return "#";
    
    if (provider.credentials.username && provider.credentials.path) {
      return `https://github.com/${provider.credentials.username}/${provider.credentials.path.split('/').pop()}`;
    }
    
    return "#";
  };
  
  // Delete repo handler
  const handleDeleteRepo = async (providerId: number) => {
    try {
      const response = await fetch(`/api/storage-providers/${providerId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to delete repository');
      }
      
      toast({
        title: "Repository deleted",
        description: "The GitHub repository has been removed from your backups.",
      });
      
      // Invalidate the storage providers query
      // queryClient.invalidateQueries(["/api/storage-providers"]);
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete repository",
        variant: "destructive",
      });
    } finally {
      setRepoToDelete(null);
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
      </div>
    );
  }
  
  if (isError) {
    return (
      <div className="text-center py-12 text-red-400">
        Failed to load GitHub repositories
      </div>
    );
  }
  
  if (gitHubProviders.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        No GitHub repositories added yet
      </div>
    );
  }
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {gitHubProviders.map((provider: StorageProvider) => {
        const lastBackup = getLastBackupForProvider(provider.id);
        const repoName = getRepoName(provider);
        const repoUrl = getRepoUrl(provider);
        
        return (
          <Card key={provider.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="flex items-center">
                    <Github className="h-4 w-4 mr-2 text-black dark:text-white" />
                    {repoName}
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {provider.name}
                  </CardDescription>
                </div>
                
                <div className="flex space-x-2">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="h-8 w-8 rounded-full"
                    onClick={() => window.open(repoUrl, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8 rounded-full text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Remove Repository</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to remove "{repoName}" from your backups? 
                          This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          className="bg-red-600 hover:bg-red-700 text-white"
                          onClick={() => handleDeleteRepo(provider.id)}
                        >
                          Remove
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Clock className="h-3.5 w-3.5 mr-1.5" />
                  <span>Added: </span>
                  <span className="ml-1 text-gray-700 dark:text-gray-300">
                    {formatDistanceToNow(new Date(provider.createdAt), { addSuffix: true })}
                  </span>
                </div>
                
                <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                  <Users className="h-3.5 w-3.5 mr-1.5" />
                  <span>Owner: </span>
                  <span className="ml-1 text-gray-700 dark:text-gray-300">
                    {provider.credentials?.username || "Unknown"}
                  </span>
                </div>
              </div>
              
              {lastBackup && (
                <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-2">Last Backup</h4>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatDistanceToNow(new Date(lastBackup.startedAt), { addSuffix: true })}
                    </span>
                    <span className={`text-sm font-medium ${
                      lastBackup.status === "completed" 
                        ? "text-green-600 dark:text-green-400" 
                        : "text-red-600 dark:text-red-400"
                    }`}>
                      {lastBackup.status.charAt(0).toUpperCase() + lastBackup.status.slice(1)}
                    </span>
                  </div>
                  {lastBackup.size && (
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Size: {Math.round(lastBackup.size / 1024)} KB
                    </div>
                  )}
                </div>
              )}
            </CardContent>
            
            <CardFooter className="border-t border-gray-100 dark:border-gray-700 py-3">
              <div className="flex items-center justify-between w-full">
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm">View Details</Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>{repoName}</DialogTitle>
                      <DialogDescription>Repository backup details</DialogDescription>
                    </DialogHeader>
                    
                    <div className="space-y-4 py-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <h3 className="text-sm font-medium mb-1">Repository</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">{repoName}</p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium mb-1">Added</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDistanceToNow(new Date(provider.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium mb-1">Owner</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {provider.credentials?.username || "Unknown"}
                          </p>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium mb-1">Path</h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {provider.credentials?.path || "Unknown"}
                          </p>
                        </div>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium mb-2">Recent Backups</h3>
                        {backups && Array.isArray(backups) && backups
                          .filter((backup: Backup) => backup.storageProviderId === provider.id)
                          .sort((a: Backup, b: Backup) => 
                            new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
                          )
                          .slice(0, 5)
                          .map((backup: Backup) => (
                            <div 
                              key={backup.id} 
                              className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0"
                            >
                              <div className="flex flex-col">
                                <span className="text-sm">
                                  {new Date(backup.startedAt).toLocaleDateString()} {new Date(backup.startedAt).toLocaleTimeString()}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {backup.size ? `${Math.round(backup.size / 1024)} KB` : 'Unknown size'}
                                </span>
                              </div>
                              <span className={`text-sm ${
                                backup.status === "completed" 
                                  ? "text-green-600 dark:text-green-400" 
                                  : "text-red-600 dark:text-red-400"
                              }`}>
                                {backup.status.charAt(0).toUpperCase() + backup.status.slice(1)}
                              </span>
                            </div>
                          ))
                        }
                        
                        {(!backups || !Array.isArray(backups) || backups
                          .filter((backup: Backup) => backup.storageProviderId === provider.id).length === 0) && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 py-2">
                            No backups found for this repository
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <DialogFooter>
                      <Button onClick={() => window.open(repoUrl, '_blank')}>
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Repository
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                
                <Button variant="default" size="sm">
                  <Download className="h-4 w-4 mr-2" />
                  Run Backup
                </Button>
              </div>
            </CardFooter>
          </Card>
        );
      })}
    </div>
  );
}