import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Plus, Search, Loader2, Activity, Settings } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import AddSiteForm from "@/components/sites/add-site-form";
import OneClickBackupButton from "@/components/backup/OneClickBackupButton";
import { Site, Backup } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";

export default function SiteManagement() {
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Fetch sites data
  const { data: sites, isLoading: sitesLoading, isError: sitesError } = useQuery({
    queryKey: ["/api/sites"],
  });
  
  // Fetch backups data
  const { data: backups } = useQuery({
    queryKey: ["/api/backups"],
  });
  
  // Fetch storage providers
  const { data: storageProviders } = useQuery({
    queryKey: ["/api/storage-providers"],
  });

  // Get the last backup for a site
  const getLastBackupForSite = (siteId: number) => {
    if (!backups || !Array.isArray(backups)) return null;
    
    const siteBackups = backups
      .filter((backup: Backup) => backup.siteId === siteId)
      .sort((a: Backup, b: Backup) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    
    return siteBackups.length > 0 ? siteBackups[0] : null;
  };
  
  // Format file size to human-readable format
  const formatFileSize = (bytes?: number): string => {
    if (!bytes) return 'N/A';
    
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;
    
    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }
    
    return `${size.toFixed(1)} ${units[unitIndex]}`;
  };

  // Filter sites based on search term
  const filteredSites = sites && Array.isArray(sites) 
    ? sites.filter((site: Site) => 
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        site.url.toLowerCase().includes(searchTerm.toLowerCase())
      ) 
    : [];

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Site Management</h1>
          <p className="text-gray-500">Manage your WordPress sites and backup schedules</p>
        </div>
        <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0">
              <Plus className="mr-1 h-4 w-4" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add a new site</DialogTitle>
              <DialogDescription>
                Enter the details of the WordPress site you want to backup.
              </DialogDescription>
            </DialogHeader>
            <AddSiteForm onSuccess={() => setIsAddingSite(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
          <input
            placeholder="Search sites..."
            className="pl-8 w-full h-10 rounded-md border"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {sitesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      ) : sitesError ? (
        <div className="text-center py-12 text-red-400">
          Failed to load sites
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchTerm ? "No sites match your search" : "No sites added yet"}
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSites.map((site: Site) => (
            <Card key={site.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg font-semibold">{site.name}</CardTitle>
                    <CardDescription className="mt-1 truncate">
                      <a href={site.url} target="_blank" rel="noopener noreferrer" className="hover:underline">{site.url}</a>
                    </CardDescription>
                  </div>
                  <Badge variant="outline" className="bg-green-50 border-green-200 text-green-700 dark:bg-green-900/20 dark:border-green-900 dark:text-green-400">Active</Badge>
                </div>
              </CardHeader>
              <CardContent className="pb-2 text-sm text-gray-500">
                {(() => {
                  const lastBackup = getLastBackupForSite(site.id);
                  
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Last Backup</p>
                        <p>
                          {lastBackup 
                            ? formatDistanceToNow(new Date(lastBackup.startedAt), { addSuffix: true })
                            : 'Never'}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Backup Size</p>
                        <p>{lastBackup ? formatFileSize(lastBackup.size) : 'N/A'}</p>
                      </div>
                      {lastBackup && (
                        <>
                          <div>
                            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Status</p>
                            <p className={
                              lastBackup.status === 'completed' ? 'text-green-600 dark:text-green-500' :
                              lastBackup.status === 'failed' ? 'text-red-600 dark:text-red-500' :
                              lastBackup.status === 'in_progress' ? 'text-blue-600 dark:text-blue-500' :
                              'text-gray-600 dark:text-gray-400'
                            }>
                              {lastBackup.status.charAt(0).toUpperCase() + lastBackup.status.slice(1).replace('_', ' ')}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400">Type</p>
                            <p className="capitalize">{lastBackup.type}</p>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })()}
              </CardContent>
              <CardFooter className="flex gap-2 pt-4">
                <OneClickBackupButton 
                  site={site} 
                  variant="default" 
                  className="flex-1 bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white shadow-md"
                >
                  One-Click Backup
                </OneClickBackupButton>
                <Button variant="outline" size="icon">
                  <Settings className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon">
                  <Activity className="h-4 w-4" />
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}