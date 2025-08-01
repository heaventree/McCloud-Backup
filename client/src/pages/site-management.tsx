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
  Settings,
  RefreshCw,
  Cloud,
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
import BackupWizard from '@/components/backup/BackupWizard';
import { Site, Backup } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { apiRequest, queryClient } from '@/lib/queryClient';

// API Key generation utility
const generateApiKey = () => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

export default function SiteManagement() {
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [backupWizardOpen, setBackupWizardOpen] = useState(false);
  const [selectedSiteForBackup, setSelectedSiteForBackup] = useState<Site | null>(null);
  const [forceRefresh, setForceRefresh] = useState(0);
  const [editForm, setEditForm] = useState({
    name: '',
    url: '',
    apiKey: '',
    backupFrequency: 'ondemand' as 'ondemand' | 'daily' | 'weekly' | 'monthly' | 'yearly',
    storageProviderId: '',
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

  // Fetch storage providers
  const { data: storageProviders } = useQuery({
    queryKey: ['/api/storage-providers'],
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

  // State for confirmation dialog
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [siteForConfirmation, setSiteForConfirmation] = useState<any>(null);

  // Handler for starting backup with confirmation
  const handleStartBackup = (site: any) => {
    setSiteForConfirmation(site);
    setShowConfirmDialog(true);
  };

  // Handler for confirming backup
  const handleConfirmBackup = () => {
    if (siteForConfirmation) {
      setSelectedSiteForBackup(siteForConfirmation);
      setBackupWizardOpen(true);
      setShowConfirmDialog(false);
      setSiteForConfirmation(null);
    }
  };

  // Handler for canceling backup
  const handleCancelBackup = () => {
    setShowConfirmDialog(false);
    setSiteForConfirmation(null);
  };

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: number;
      data: { name: string; url: string; apiKey: string; backupFrequency: string; storageProviderId: string };
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
      storageProviderId: site.storageProviderId?.toString() || '',
    });
  };

  const handleUpdateSite = () => {
    if (editingSite) {
      updateMutation.mutate({
        id: editingSite.id,
        data: {
          ...editForm,
          storageProviderId: editForm.storageProviderId ? parseInt(editForm.storageProviderId, 10) : undefined,
        },
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
    <div className="container mx-auto min-h-screen bg-gray-50 p-3 sm:p-6 dark:bg-gray-900">
      <div className="mb-4 sm:mb-6 flex flex-col items-start justify-between sm:flex-row sm:items-center">
        <div className="mb-3 sm:mb-0">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-800 dark:text-gray-100">
            Site Management
          </h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
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
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredSites.map((site: Site) => {
            const lastBackup = getLastBackupForSite(site.id);

            return (
              <div
                key={site.id}
                className="rounded-lg border border-gray-200 bg-white p-4 sm:p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
              >
                {/* Header with title and status */}
                <div className="mb-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="mb-1 text-lg sm:text-xl font-semibold text-gray-900 dark:text-gray-100 truncate">
                      {site.name}
                    </h3>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 truncate">{site.url}</p>
                  </div>
                  <Badge
                    variant="outline"
                    className="border-green-200 bg-green-50 px-2 py-1 text-xs text-green-700 dark:border-green-700 dark:bg-green-900/20 dark:text-green-400 self-start"
                  >
                    Active
                  </Badge>
                </div>

                {/* Stats Grid */}
                <div className="mb-4 sm:mb-6 grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-6">
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
                      {site.backupFrequency === 'ondemand' ? 'On Demand' : 
                       site.backupFrequency === '5min' ? 'Every 5 Min' : 
                       site.backupFrequency}
                    </p>
                  </div>
                </div>

                {/* Storage Provider Information */}
                <div className="mb-4 sm:mb-6">
                  <div className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                    <div className="flex items-center gap-2">
                      <Cloud className="h-4 w-4 text-blue-500 flex-shrink-0" />
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                        STORAGE PROVIDER
                      </p>
                    </div>
                    <p className="mt-1 text-xs sm:text-sm font-medium text-gray-900 dark:text-gray-100 break-words">
                      {site.storageProviderId 
                        ? (() => {
                            const provider = storageProviders?.find((p: any) => p.id === site.storageProviderId);
                            return provider ? `${provider.name} (${provider.type})` : 'Unknown Provider';
                          })()
                        : 'Not selected'}
                    </p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                  <Button 
                    onClick={() => handleStartBackup(site)}
                    className="flex flex-1 items-center justify-center space-x-2 rounded-md bg-purple-600 bg-gradient-to-br from-indigo-500 to-purple-600 py-2.5 sm:py-3 text-sm sm:text-base font-medium text-white transition-colors hover:bg-purple-700"
                  >
                    <Archive className="h-4 w-4 flex-shrink-0" />
                    <span>One-Click Backup</span>
                  </Button>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        className="border-gray-300 bg-white p-3 hover:bg-gray-50 dark:border-gray-600 dark:bg-gray-700 dark:hover:bg-gray-600"
                      >
                        <Settings className="h-4 w-4 text-gray-600 dark:text-gray-400" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="end"
                      className="w-48 border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                    >
                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        onClick={() => handleEditSite(site)}
                        className="cursor-pointer text-gray-700 transition-colors duration-200 hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 focus:text-blue-700 dark:text-gray-300 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 dark:focus:bg-blue-900/20 dark:focus:text-blue-400"
                      >
                        <Edit className="mr-2 h-4 w-4" />
                        Edit Site
                      </DropdownMenuItem>

                      <DropdownMenuSeparator className="bg-gray-200 dark:bg-gray-700" />

                      <DropdownMenuItem
                        onSelect={(e) => e.preventDefault()}
                        onClick={() => setSiteToDelete(site)}
                        className="cursor-pointer text-red-600 transition-colors duration-200 hover:bg-red-50 hover:text-red-700 focus:bg-red-50 focus:text-red-700 dark:text-red-400 dark:hover:bg-red-900/20 dark:hover:text-red-300 dark:focus:bg-red-900/20 dark:focus:text-red-300"
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
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={editForm.apiKey}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, apiKey: e.target.value }))}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    const newApiKey = generateApiKey();
                    setEditForm((prev) => ({ ...prev, apiKey: newApiKey }));
                    toast({
                      title: "API Key Generated",
                      description: "A new API key has been generated and applied.",
                    });
                  }}
                  className="flex-shrink-0"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                This key will be used to authenticate backup requests from your WordPress site.
              </p>
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
                      | '5min'
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
                  <SelectItem value="5min" className="text-gray-900 dark:text-gray-100">
                    Every 5 Minutes - Automatic backups every 5 minutes
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

          {/* Storage Provider Field */}
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Storage Provider
            </label>
            <Select
              value={editForm.storageProviderId}
              onValueChange={(value) => setEditForm({ ...editForm, storageProviderId: value })}
            >
              <SelectTrigger className="bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100">
                <SelectValue placeholder="Select storage provider" />
              </SelectTrigger>
              <SelectContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
                {storageProviders && storageProviders.length > 0 ? (
                  storageProviders.map((provider: any) => (
                    <SelectItem
                      key={provider.id}
                      value={provider.id.toString()}
                      className="text-gray-900 dark:text-gray-100"
                    >
                      {provider.name} ({provider.type})
                    </SelectItem>
                  ))
                ) : (
                  <SelectItem value="" disabled className="text-gray-500">
                    No storage providers available
                  </SelectItem>
                )}
              </SelectContent>
            </Select>
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

      {/* Backup Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-gray-800 dark:text-gray-100">
              Start Backup?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
              Are you sure you want to start a backup for "{siteForConfirmation?.name}"?
              {siteForConfirmation?.storageProviderId 
                ? " The backup will be saved to your pre-selected storage provider."
                : " You'll be able to choose a storage provider next."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel 
              onClick={handleCancelBackup}
              className="bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmBackup}
              className="bg-blue-600 text-white hover:bg-blue-700"
            >
              Start Backup
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Backup Wizard */}
      <BackupWizard
        open={backupWizardOpen}
        onClose={() => {
          setBackupWizardOpen(false);
          setSelectedSiteForBackup(null);
        }}
        site={selectedSiteForBackup}
      />
    </div>
  );
}
