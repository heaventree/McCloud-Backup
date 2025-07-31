import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Site } from "@/lib/types";
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
  DialogClose
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
import { useToast } from "@/hooks/use-toast";
import AddSiteForm from "@/components/sites/add-site-form";
import { formatDistanceToNow } from "date-fns";
import { 
  Plus, 
  Search, 
  Loader2, 
  Globe, 
  ExternalLink, 
  Key, 
  Trash,
  Clock,
  Archive,
  Settings,
  Copy,
  MoreVertical,
  Edit,
  Calendar
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

const Sites = () => {
  const { toast } = useToast();
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [editForm, setEditForm] = useState({ name: "", url: "", apiKey: "" });

  const { data: sites, isLoading, isError } = useQuery({
    queryKey: ["/api/sites"],
  });

  const { data: backups } = useQuery({
    queryKey: ["/api/backups"],
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({
        title: "Site deleted",
        description: "The site has been removed successfully",
      });
      setSiteToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting site",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: { name: string; url: string; apiKey: string } }) => {
      await apiRequest("PUT", `/api/sites/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({
        title: "Site updated",
        description: "The site has been updated successfully",
      });
      setEditingSite(null);
    },
    onError: (error) => {
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

  // Filter sites based on search term
  const filteredSites = sites && Array.isArray(sites) 
    ? sites.filter((site: Site) => 
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        site.url.toLowerCase().includes(searchTerm.toLowerCase())
      ) 
    : [];

  // Get last backup for a site
  const getLastBackupForSite = (siteId: number) => {
    if (!backups || !Array.isArray(backups)) return null;
    
    const siteBackups = backups
      .filter((backup: any) => backup.siteId === siteId)
      .sort((a: any, b: any) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    
    return siteBackups.length > 0 ? siteBackups[0] : null;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Sites</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your WordPress sites for backup</p>
        </div>
        <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-1 h-4 w-4" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <DialogHeader>
              <DialogTitle className="text-gray-800 dark:text-gray-100">Add a new site</DialogTitle>
            </DialogHeader>
            <AddSiteForm onSuccess={() => setIsAddingSite(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            placeholder="Search sites..."
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
          Failed to load sites
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchTerm ? "No sites match your search" : "No sites added yet"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSites.map((site: Site) => {
            const lastBackup = getLastBackupForSite(site.id);
            
            return (
              <div key={site.id} className="bg-white dark:bg-gray-800 rounded-md overflow-hidden shadow border border-gray-200 dark:border-gray-700">
                <div className="px-4 py-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">{site.name}</h3>
                      <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Globe className="h-3.5 w-3.5 mr-1" />
                        {site.url}
                      </div>
                    </div>
                    <button 
                      className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-blue-600 transition-colors text-gray-600 dark:text-gray-300 hover:text-white"
                      onClick={() => window.open(`https://${site.url}`, '_blank')}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                  
                  <div className="mt-4 space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500 dark:text-gray-400 flex items-center">
                        <Key className="h-3.5 w-3.5 mr-1" />
                        API Key:
                      </span>
                      <code className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
                        {site.apiKey.substring(0, 8)}...
                      </code>
                    </div>
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
                              <div className="flex">
                                <Input 
                                  value={editForm.apiKey}
                                  onChange={(e) => setEditForm(prev => ({ ...prev, apiKey: e.target.value }))}
                                  className="flex-1 rounded-r-none border-r-0"
                                />
                                <Button
                                  variant="outline"
                                  className="rounded-l-none"
                                  onClick={() => {
                                    navigator.clipboard.writeText(editForm.apiKey);
                                    toast({
                                      title: "API Key copied",
                                      description: "API Key has been copied to clipboard",
                                    });
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-end space-x-2 mt-4">
                            <DialogClose asChild>
                              <Button variant="outline" onClick={() => setEditingSite(null)}>Cancel</Button>
                            </DialogClose>
                            <Button 
                              onClick={handleUpdateSite}
                              disabled={updateMutation.isPending}
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
};

export default Sites;
