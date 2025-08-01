import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Plus, 
  Search, 
  Loader2, 
  Globe, 
  ExternalLink, 
  Trash,
  Archive,
  Copy,
  MoreVertical,
  Edit,
  Calendar,
  Clock
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import AddSiteForm from "@/components/sites/add-site-form";
import { Site, Backup } from "@/lib/types";
import { formatDistanceToNow } from "date-fns";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function SiteManagement() {
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    url: "",
    apiKey: "",
    backupFrequency: "ondemand" as "ondemand" | "daily" | "weekly" | "monthly" | "yearly",
  });
  const { toast } = useToast();

  // Fetch sites data
  const { data: sites, isLoading: sitesLoading, isError: sitesError } = useQuery({
    queryKey: ["/api/sites"],
  });
  
  // Fetch backups data for recent backups
  const { data: backups } = useQuery({
    queryKey: ["/api/backups/recent"],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (siteId: number) => {
      await apiRequest("DELETE", `/api/sites/${siteId}`);
      return siteId;
    },
    onMutate: async (siteId) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["/api/sites"] });

      // Snapshot the previous value for rollback if needed
      const previousSites = queryClient.getQueryData(["/api/sites"]);

      // Don't do optimistic update for delete - let the server response handle it
      // This ensures the UI refreshes with actual server state

      // Return a context with the previous value
      return { previousSites };
    },
    onSuccess: async (siteId) => {
      // Invalidate and refetch queries to ensure server state
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/sites"] }),
        queryClient.refetchQueries({ queryKey: ["/api/sites"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/backups/recent"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/backups"] })
      ]);
      
      toast({
        title: "Site deleted",
        description: "The site has been deleted successfully",
      });
      setSiteToDelete(null);
    },
    onError: (error, siteId, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousSites) {
        queryClient.setQueryData(["/api/sites"], context.previousSites);
      }
      
      toast({
        title: "Error deleting site",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; url: string; apiKey: string; backupFrequency: string } }) => {
      await apiRequest("PUT", `/api/sites/${id}`, data);
      return { id, data };
    },
    onMutate: async ({ id, data }) => {
      // Cancel any outgoing refetches to prevent race conditions
      await queryClient.cancelQueries({ queryKey: ["/api/sites"] });

      // Snapshot the previous value for rollback if needed
      const previousSites = queryClient.getQueryData(["/api/sites"]);

      // Don't do optimistic update for edit - let the server response handle it
      // This ensures the UI refreshes with actual server state

      return { previousSites };
    },
    onSuccess: async ({ id, data }) => {
      // Invalidate and refetch queries to ensure server state
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/sites"] }),
        queryClient.refetchQueries({ queryKey: ["/api/sites"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/backups/recent"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/backups"] })
      ]);
      
      toast({
        title: "Site updated",
        description: "The site has been updated successfully",
      });
      setEditingSite(null);
    },
    onError: (error, variables, context) => {
      // If the mutation fails, use the context to roll back
      if (context?.previousSites) {
        queryClient.setQueryData(["/api/sites"], context.previousSites);
      }
      
      toast({
        title: "Error updating site",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    setEditForm({
      name: site.name,
      url: site.url,
      apiKey: site.apiKey,
      backupFrequency: (site.backupFrequency as "ondemand" | "daily" | "weekly" | "monthly" | "yearly") || "ondemand",
    });
  };

  const handleUpdateSite = () => {
    if (editingSite) {
      updateMutation.mutate({
        id: editingSite.id,
        data: editForm,
      });
    }
  };

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

  // Filter sites based on search term
  const filteredSites = sites && Array.isArray(sites) 
    ? sites.filter((site: Site) => 
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        site.url.toLowerCase().includes(searchTerm.toLowerCase())
      ) 
    : [];

  return (
    <div className="container mx-auto p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Site Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your WordPress sites and backup schedules</p>
        </div>
        <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <DialogHeader>
              <DialogTitle className="text-gray-800 dark:text-gray-100">Add a new site</DialogTitle>
              <DialogDescription className="text-gray-500 dark:text-gray-400">
                Enter the details of the WordPress site you want to backup.
              </DialogDescription>
            </DialogHeader>
            <AddSiteForm onSuccess={() => setIsAddingSite(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <Input
            placeholder="Search sites..."
            className="pl-8 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {sitesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
        </div>
      ) : sitesError ? (
        <div className="text-center py-12 text-red-500 dark:text-red-400">
          Failed to load sites
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {searchTerm ? "No sites match your search" : "No sites added yet"}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSites.map((site: Site) => {
            const lastBackup = getLastBackupForSite(site.id);
            
            return (
              <div
                key={site.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 truncate">
                          {site.name}
                        </h3>
                      </div>
                      <div className="flex items-center space-x-1 mt-1">
                        <ExternalLink className="h-3 w-3 text-gray-400" />
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-gray-600 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                        >
                          {site.url}
                        </a>
                      </div>
                    </div>
                    <Badge 
                      variant="outline" 
                      className="bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400 flex-shrink-0"
                    >
                      Active
                    </Badge>
                  </div>

                  <Separator className="my-4 bg-gray-200 dark:bg-gray-700" />

                  <div className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Clock className="h-3.5 w-3.5 mr-1" />
                        Added:
                      </span>
                      <span className="text-gray-700 dark:text-gray-300">{formatDistanceToNow(new Date(site.createdAt), { addSuffix: true })}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Archive className="h-3.5 w-3.5 mr-1" />
                        Last Backup:
                      </span>
                      <span>
                        {lastBackup ? (
                          <span className={lastBackup.status === "completed" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                            {formatDistanceToNow(new Date(lastBackup.startedAt), { addSuffix: true })}
                          </span>
                        ) : (
                          <span className="text-gray-700 dark:text-gray-300">Never</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Calendar className="h-3.5 w-3.5 mr-1" />
                        Backup Frequency:
                      </span>
                      <span className="text-gray-700 dark:text-gray-300 capitalize">
                        {site.backupFrequency === 'ondemand' ? 'On Demand' : site.backupFrequency}
                      </span>
                    </div>
                  </div>
                </div>
                
                <div className="border-t border-gray-200 dark:border-gray-700 mt-3"></div>
                
                <div className="px-4 py-3 flex justify-between">
                  <button className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-md transition-colors">
                    Run Backup
                  </button>
                  
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-2 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48 bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                      <DropdownMenuItem 
                        onSelect={(e) => e.preventDefault()}
                        onClick={() => handleEditSite(site)}
                        className="cursor-pointer text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Edit Site
                      </DropdownMenuItem>
                      
                      <Dialog open={editingSite?.id === site.id} onOpenChange={(open) => !open && setEditingSite(null)}>
                        <DialogTrigger asChild>
                          <div style={{ display: 'none' }} />
                        </DialogTrigger>
                        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                          <DialogHeader>
                            <DialogTitle className="text-gray-800 dark:text-gray-100">Edit Site Settings</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Name</label>
                              <Input 
                                value={editForm.name}
                                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site URL</label>
                              <Input 
                                value={editForm.url}
                                onChange={(e) => setEditForm(prev => ({ ...prev, url: e.target.value }))}
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                              <Input 
                                type="password"
                                value={editForm.apiKey}
                                onChange={(e) => setEditForm(prev => ({ ...prev, apiKey: e.target.value }))}
                                className="w-full"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 flex items-center gap-2">
                                <Calendar className="h-4 w-4" />
                                Backup Frequency
                              </label>
                              <Select 
                                value={editForm.backupFrequency} 
                                onValueChange={(value) => setEditForm(prev => ({ ...prev, backupFrequency: value as "ondemand" | "daily" | "weekly" | "monthly" | "yearly" }))}
                              >
                                <SelectTrigger className="w-full bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                                  <SelectValue placeholder="Select backup frequency" />
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                                  <SelectItem value="ondemand" className="text-gray-900 dark:text-gray-100">
                                    On Demand - Manual backups only
                                  </SelectItem>
                                  <SelectItem value="daily" className="text-gray-900 dark:text-gray-100">
                                    Daily - Backup every day
                                  </SelectItem>
                                  <SelectItem value="weekly" className="text-gray-900 dark:text-gray-100">
                                    Weekly - Backup once per week
                                  </SelectItem>
                                  <SelectItem value="monthly" className="text-gray-900 dark:text-gray-100">
                                    Monthly - Backup once per month
                                  </SelectItem>
                                  <SelectItem value="yearly" className="text-gray-900 dark:text-gray-100">
                                    Yearly - Backup once per year
                                  </SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2">
                            <Button variant="outline" onClick={() => setEditingSite(null)}>
                              Cancel
                            </Button>
                            <Button 
                              onClick={handleUpdateSite}
                              disabled={updateMutation.isPending}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              {updateMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Updating...
                                </>
                              ) : (
                                "Save Changes"
                              )}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      
                      <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />
                      
                      <DropdownMenuItem 
                        onSelect={(e) => e.preventDefault()}
                        onClick={() => setSiteToDelete(site)}
                        className="cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:bg-red-50 dark:focus:bg-red-900/20"
                      >
                        <Trash className="h-4 w-4 mr-2" />
                        Delete Site
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!siteToDelete} onOpenChange={(open) => !open && setSiteToDelete(null)}>
        <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-800 dark:text-gray-100">Delete Site</AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              Are you sure you want to delete "{siteToDelete?.name}"? This action cannot be undone and all backup records for this site will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              className="bg-red-600 hover:bg-red-700 text-white"
              onClick={() => siteToDelete && deleteMutation.mutate(siteToDelete.id)}
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
  );
}