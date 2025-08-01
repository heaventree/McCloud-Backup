import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Clock,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from '@/components/ui/dialog';
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
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import AddSiteForm from '@/components/sites/add-site-form';
import { Site, Backup } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';

export default function SiteManagement() {
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [editForm, setEditForm] = useState({
    name: '',
    url: '',
    apiKey: '',
    backupFrequency: 'ondemand' as 'ondemand' | 'daily' | 'weekly' | 'monthly' | 'yearly',
  });
  const { toast } = useToast();

  // Fetch sites data
  const {
    data: sites,
    isLoading: sitesLoading,
    isError: sitesError,
    refetch,
  } = useQuery({
    queryKey: ['/api/sites', forceRefresh],
  });

  // Fetch backups data for recent backups
  const { data: backups } = useQuery({
    queryKey: ['/api/backups/recent'],
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (siteId: number) => {
      await apiRequest('DELETE', `/api/sites/${siteId}`);
      return siteId;
    },
    onSuccess: () => {
      // Force immediate invalidation and refetch
      queryClient.invalidateQueries({
        queryKey: ['/api/sites'],
        exact: false,
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/backups/recent'],
        exact: false,
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/backups'],
        exact: false,
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/dashboard/stats'],
        exact: false,
        refetchType: 'active',
      });

      // Force immediate refresh of the list
      setForceRefresh((prev) => prev + 1);
      // Force refetch with a small delay to ensure DB has settled
      setTimeout(() => {
        refetch();
      }, 100);

      toast({
        title: 'Site deleted',
        description: 'The site has been deleted successfully',
      });
      setSiteToDelete(null);
    },
    onError: (error) => {
      toast({
        title: 'Error deleting site',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; url: string; apiKey: string; backupFrequency: string };
    }) => {
      await apiRequest('PUT', `/api/sites/${id}`, data);
      return { id, data };
    },
    onSuccess: () => {
      // Force immediate invalidation and refetch
      queryClient.invalidateQueries({
        queryKey: ['/api/sites'],
        exact: false,
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/backups/recent'],
        exact: false,
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/backups'],
        exact: false,
        refetchType: 'active',
      });
      queryClient.invalidateQueries({
        queryKey: ['/api/dashboard/stats'],
        exact: false,
        refetchType: 'active',
      });

      // Force immediate refresh of the list
      setForceRefresh((prev) => prev + 1);
      // Force refetch with a small delay to ensure DB has settled
      setTimeout(() => {
        refetch();
      }, 100);

      toast({
        title: 'Site updated',
        description: 'The site has been updated successfully',
      });
      setEditingSite(null);
    },
    onError: (error) => {
      toast({
        title: 'Error updating site',
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: 'destructive',
      });
    },
  });

  const handleEditSite = (site: Site) => {
    setEditingSite(site);
    setEditForm({
      name: site.name,
      url: site.url,
      apiKey: site.apiKey,
      backupFrequency:
        (site.backupFrequency as 'ondemand' | 'daily' | 'weekly' | 'monthly' | 'yearly') ||
        'ondemand',
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
      .sort(
        (a: Backup, b: Backup) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );

    return siteBackups.length > 0 ? siteBackups[0] : null;
  };

  // Filter sites based on search term
  const filteredSites =
    sites && Array.isArray(sites)
      ? sites.filter(
          (site: Site) =>
            site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            site.url.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : [];

  return (
    <div className="container mx-auto min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mb-6 flex flex-col items-start justify-between sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
            Site Management
          </h1>
          <p className="text-gray-500 dark:text-gray-400">
            Manage your WordPress sites and backup schedules
          </p>
        </div>
        <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
          <DialogTrigger asChild>
            <Button className="mt-4 bg-blue-600 text-white hover:bg-blue-700 sm:mt-0">
              <Plus className="mr-2 h-4 w-4" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent className="border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
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
            className="border-gray-200 bg-white pl-8 text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
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
        <div className="py-12 text-center text-red-500 dark:text-red-400">Failed to load sites</div>
      ) : filteredSites.length === 0 ? (
        <div className="py-12 text-center text-gray-500 dark:text-gray-400">
          {searchTerm ? 'No sites match your search' : 'No sites added yet'}
        </div>
      ) : (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredSites.map((site: Site) => {
            const lastBackup = getLastBackupForSite(site.id);

            return (
              <div
                key={site.id}
                className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                {/* Header with title and status */}
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex-1">
                    <h3 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">
                      {site.name}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">{site.url}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400"
                  >
                    Active
                  </Badge>
                </div>

                {/* Stats Grid */}
                <div className="mb-6 grid grid-cols-2 gap-6">
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      LAST BACKUP
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {lastBackup
                        ? formatDistanceToNow(new Date(lastBackup.startedAt), { addSuffix: true })
                        : 'Never'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      BACKUP SIZE
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">N/A</p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      STATUS
                    </p>
                    <p
                      className={`text-sm font-medium ${lastBackup?.status === 'completed' ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-gray-100'}`}
                    >
                      {lastBackup?.status === 'completed' ? 'Completed' : 'Ready'}
                    </p>
                  </div>
                  <div>
                    <p className="mb-1 text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                      TYPE
                    </p>
                    <p className="text-sm font-medium capitalize text-gray-900 dark:text-gray-100">
                      {site.backupFrequency === 'ondemand' ? 'On Demand' : site.backupFrequency}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center space-x-3">
                  <Button className="flex flex-1 items-center justify-center space-x-2 rounded-md bg-purple-600 bg-gradient-to-br from-indigo-500 to-purple-600 py-3 font-medium text-white transition-colors hover:bg-purple-700">
                    <Archive className="h-4 w-4" />
                    <span>One-Click Backup</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-gray-300 bg-white p-3 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
                      >
                        <svg
                          className="h-4 w-4 text-gray-600 dark:text-gray-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                          />
                        </svg>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
                    >
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        onClick={() => handleEditSite(site)}
                        className="cursor-pointer text-gray-700 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-700"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Site
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />

                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        onClick={() => setSiteToDelete(site)}
                        className="cursor-pointer text-red-600 hover:bg-red-50 focus:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20 dark:focus:bg-red-900/20"
                      >
                        <Trash className="mr-2 h-4 w-4" />
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

      {/* Edit Site Dialog */}
      <Dialog open={!!editingSite} onOpenChange={(open) => !open && setEditingSite(null)}>
        <DialogContent className="border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          <DialogHeader>
            <DialogTitle className="text-gray-800 dark:text-gray-100">
              Edit Site Settings
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Site Name
              </label>
              <Input
                value={editForm.name}
                onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                Site URL
              </label>
              <Input
                value={editForm.url}
                onChange={(e) => setEditForm((prev) => ({ ...prev, url: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
                API Key
              </label>
              <Input
                type="password"
                value={editForm.apiKey}
                onChange={(e) => setEditForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                className="w-full"
              />
            </div>
            <div>
              <label className="mb-1 block flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                <Calendar className="h-4 w-4" />
                Backup Frequency
              </label>
              <Select
                value={editForm.backupFrequency}
                onValueChange={(value) =>
                  setEditForm((prev) => ({
                    ...prev,
                    backupFrequency: value as
                      | 'ondemand'
                      | 'daily'
                      | 'weekly'
                      | 'monthly'
                      | 'yearly',
                  }))
                }
              >
                <SelectTrigger className="w-full bg-white text-gray-900 dark:bg-gray-700 dark:text-gray-100">
                  <SelectValue placeholder="Select backup frequency" />
                </SelectTrigger>
                <SelectContent className="border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
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
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Save Changes'
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!siteToDelete} onOpenChange={(open) => !open && setSiteToDelete(null)}>
        <AlertDialogContent className="border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-800 dark:text-gray-100">
              Delete Site
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              Are you sure you want to delete "{siteToDelete?.name}"? This action cannot be undone
              and all backup records for this site will be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-700"
              onClick={() => siteToDelete && deleteMutation.mutate(siteToDelete.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
