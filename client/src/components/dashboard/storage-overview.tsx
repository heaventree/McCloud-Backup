import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { StorageProvider } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Cloud, Plus, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AddStorageForm from "@/components/storage/add-storage-form";
import { SvglIcon } from "@/components/ui/svgl-icon";

const StorageOverview = () => {
  const [isAddingStorage, setIsAddingStorage] = useState(false);
  
  const { data: storageProviders, isLoading, isError } = useQuery<StorageProvider[]>({
    queryKey: ["/api/storage-providers"],
  });

  const { data: backups } = useQuery<any[]>({
    queryKey: ["/api/backups"],
  });

  // Format the size to human-readable format
  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return "0 B";
    
    const units = ["B", "KB", "MB", "GB", "TB"];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(0)} ${units[unitIndex]}`;
  };

  // Calculate storage usage
  const calculateUsage = (providerId: number) => {
    if (!backups || !Array.isArray(backups)) {
      return {
        usedBytes: 0,
        usedFormatted: formatSize(0),
        backupCount: 0,
      };
    }
    
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
      usedFormatted: formatSize(totalSize),
      backupCount: count,
    };
  };

  // Calculate usage percentage
  const calculatePercentage = (used: number, quota: number | null) => {
    if (!quota) return 0;
    return Math.min(Math.round((used / quota) * 100), 100);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Storage Overview</CardTitle>
        <Button 
          variant="ghost" 
          className="text-primary hover:text-primary-dark text-sm font-medium"
        >
          Manage Storage
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-red-500">
            Failed to load storage providers
          </div>
        ) : storageProviders && Array.isArray(storageProviders) && storageProviders.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No storage providers configured
          </div>
        ) : (
          <div className="space-y-4">
            {storageProviders && Array.isArray(storageProviders) ? storageProviders.map((provider: StorageProvider) => {
              const usage = calculateUsage(provider.id);
              const percentage = calculatePercentage(usage.usedBytes, provider.quota);
              
              return (
                <div key={provider.id}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center">
                      <SvglIcon providerType={provider.type.replace("_", "-")} className="mr-2 text-neutral-600" width={20} height={20} />
                      <span className="font-medium text-neutral-700">{provider.name}</span>
                    </div>
                    <span className="text-sm text-neutral-600">
                      <span className="font-medium">{usage.usedFormatted}</span>
                      {provider.quota ? ` / ${formatSize(provider.quota)}` : ""}
                    </span>
                  </div>
                  <Progress value={percentage} className="h-2" />
                  <div className="mt-1 text-xs text-neutral-600 flex justify-between">
                    <span>{usage.backupCount} {usage.backupCount === 1 ? 'backup' : 'backups'}</span>
                    <span>{percentage}% used</span>
                  </div>
                </div>
              );
            }) : null}
            
            <Dialog open={isAddingStorage} onOpenChange={setIsAddingStorage}>
              <DialogTrigger asChild>
                <Button className="mt-4 w-full" variant="outline">
                  <Plus className="mr-1 h-4 w-4" />
                  <span>Add Storage Provider</span>
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
        )}
      </CardContent>
    </Card>
  );
};

export default StorageOverview;
