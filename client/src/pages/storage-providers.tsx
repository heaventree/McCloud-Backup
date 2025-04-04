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
      case "dropbox":
      case "s3":
        return <Cloud className="h-5 w-5" />;
      case "ftp":
        return <Database className="h-5 w-5" />;
      case "local":
        return <HardDrive className="h-5 w-5" />;
      default:
        return <Cloud className="h-5 w-5" />;
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Storage Providers</h1>
          <p className="text-muted-foreground">Manage your backup storage destinations</p>
        </div>
        <Dialog open={isAddingStorage} onOpenChange={setIsAddingStorage}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0">
              <Plus className="mr-1 h-4 w-4" />
              Add Storage Provider
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Storage Provider</DialogTitle>
            </DialogHeader>
            <AddStorageForm onSuccess={() => setIsAddingStorage(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search storage providers..."
            className="pl-8"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">
          Failed to load storage providers
        </div>
      ) : filteredProviders.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {searchTerm ? "No storage providers match your search" : "No storage providers added yet"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredProviders.map((provider: StorageProvider) => {
            const usage = calculateUsage(provider.id);
            const percentage = calculatePercentage(usage.usedBytes, provider.quota);
            
            return (
              <Card key={provider.id} className="overflow-hidden border-muted/20">
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="p-2 rounded-full bg-primary/10 text-primary">
                        {getStorageTypeIcon(provider.type)}
                      </div>
                      <div>
                        <CardTitle>{provider.name}</CardTitle>
                        <CardDescription>
                          {getStorageTypeDisplay(provider.type)}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">Storage Usage</span>
                      <span className="text-sm font-medium">
                        {formatSize(usage.usedBytes)}
                        {provider.quota ? ` / ${formatSize(provider.quota)}` : ""}
                      </span>
                    </div>
                    <Progress value={percentage} className="h-2" />
                    <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                      <span>{usage.backupCount} {usage.backupCount === 1 ? 'backup' : 'backups'}</span>
                      <span>{percentage}% used</span>
                    </div>
                  </div>
                  
                  <div className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Type:</span>
                      <span>{getStorageTypeDisplay(provider.type)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Added:</span>
                      <span>{formatDistanceToNow(new Date(provider.createdAt), { addSuffix: true })}</span>
                    </div>
                    {provider.type === 's3' && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Bucket:</span>
                        <span className="truncate max-w-[150px]">{provider.credentials.bucket}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
                <Separator />
                <CardFooter className="flex justify-between p-4">
                  <Button variant="outline">
                    <Edit className="mr-1 h-4 w-4" />
                    Edit
                  </Button>
                  <AlertDialog open={providerToDelete?.id === provider.id} onOpenChange={(open) => !open && setProviderToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setProviderToDelete(provider)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Storage Provider</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{provider.name}"? This action cannot be undone. All backups stored with this provider will be inaccessible.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          className="bg-destructive hover:bg-destructive/90"
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
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StorageProviders;
