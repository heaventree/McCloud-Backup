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
  Archive
} from "lucide-react";

const Sites = () => {
  const { toast } = useToast();
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);

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
          <h1 className="text-2xl font-bold tracking-tight dark:text-gray-100">Sites</h1>
          <p className="text-muted-foreground dark:text-gray-400">Manage your WordPress sites for backup</p>
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
            </DialogHeader>
            <AddSiteForm onSuccess={() => setIsAddingSite(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search sites..."
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
          Failed to load sites
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          {searchTerm ? "No sites match your search" : "No sites added yet"}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredSites.map((site: Site) => {
            const lastBackup = getLastBackupForSite(site.id);
            
            return (
              <Card key={site.id} className="overflow-hidden border-muted/20">
                <CardHeader className="pb-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{site.name}</CardTitle>
                      <CardDescription className="mt-1 flex items-center">
                        <Globe className="h-3.5 w-3.5 mr-1" />
                        {site.url}
                      </CardDescription>
                    </div>
                    <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => window.open(`https://${site.url}`, '_blank')}>
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="text-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center">
                      <Key className="h-3.5 w-3.5 mr-1" />
                      API Key:
                    </span>
                    <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">
                      {site.apiKey.substring(0, 8)}...
                    </code>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center">
                      <Clock className="h-3.5 w-3.5 mr-1" />
                      Added:
                    </span>
                    <span>{formatDistanceToNow(new Date(site.createdAt), { addSuffix: true })}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground flex items-center">
                      <Archive className="h-3.5 w-3.5 mr-1" />
                      Last Backup:
                    </span>
                    <span>
                      {lastBackup ? (
                        <span className={lastBackup.status === "completed" ? "text-green-600" : "text-red-500"}>
                          {formatDistanceToNow(new Date(lastBackup.startedAt), { addSuffix: true })}
                        </span>
                      ) : (
                        <span>Never</span>
                      )}
                    </span>
                  </div>
                </CardContent>
                <Separator />
                <CardFooter className="flex justify-between p-4">
                  <Button variant="outline">Run Backup</Button>
                  <AlertDialog open={siteToDelete?.id === site.id} onOpenChange={(open) => !open && setSiteToDelete(null)}>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setSiteToDelete(site)}>
                        <Trash className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Delete Site</AlertDialogTitle>
                        <AlertDialogDescription>
                          Are you sure you want to delete "{site.name}"? This action cannot be undone and all backup records for this site will be lost.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                          className="bg-destructive hover:bg-destructive/90"
                          onClick={() => deleteMutation.mutate(site.id)}
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

export default Sites;
