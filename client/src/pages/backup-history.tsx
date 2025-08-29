import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from '@/components/ui/alert-dialog';
import { Site, Backup, StorageProvider } from '@/lib/types';
import {
  Search,
  Download,
  RefreshCw,
  MoreVertical,
  FileDown,
  Trash,
  Filter,
  Loader2,
  ExternalLink,
  XCircle,
  CheckCircle,
  FileText,
  Eye,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { DownloadProgress } from '@/components/DownloadProgress';
import { DownloadConfirmDialog } from '@/components/DownloadConfirmDialog';

const BackupHistory = () => {
  const [location] = useLocation();
  const [siteFilter, setSiteFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [typeFilter, setTypeFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);

  // Extract site ID from URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const siteId = urlParams.get('siteId');
    if (siteId) {
      setSiteFilter(siteId);
    }
  }, [location]);

  // Dialog states
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [backupLogs, setBackupLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);

  // Enhanced download states - replacing old download progress states
  const [downloadState, setDownloadState] = useState<{
    isVisible: boolean;
    downloadedBytes: number;
    filename: string;
    isCompleted: boolean;
    abortController?: AbortController;
  }>({
    isVisible: false,
    downloadedBytes: 0,
    filename: '',
    isCompleted: false,
  });

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    backup: any | null;
    fileSize: number;
    filename: string;
    isLoading: boolean;
  }>({
    isOpen: false,
    backup: null,
    fileSize: 0,
    filename: '',
    isLoading: false,
  });

  const [isExportingPDF, setIsExportingPDF] = useState(false);

  const { toast } = useToast();

  // Mutations for backup actions
  const deleteMutation = useMutation({
    mutationFn: async (backupId: number) => {
      return apiRequest('DELETE', `/api/backups/${backupId}`);
    },
    onSuccess: () => {
      // Force refresh the backup list
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      queryClient.refetchQueries({ queryKey: ['/api/backups'] });
      toast({
        title: 'Success',
        description: 'Backup deleted successfully.',
      });
      setShowDeleteDialog(false);
      setSelectedBackup(null);
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to delete backup.',
        variant: 'destructive',
      });
    },
  });

  const retryMutation = useMutation({
    mutationFn: async (backup: Backup) => {
      return apiRequest('POST', `/api/backups/${backup.id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      toast({
        title: 'Success',
        description: 'Backup retry initiated successfully.',
      });
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to retry backup.',
        variant: 'destructive',
      });
    },
  });

  // Function to handle PDF export
  const handleExportPDF = async () => {
    try {
      setIsExportingPDF(true);

      const response = await fetch('/api/backups/export-pdf', {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'PDF export failed' }));
        throw new Error(error.message || 'PDF export failed');
      }

      // Get filename from response headers
      const contentDisposition = response.headers.get('content-disposition');
      let filename = `backup-history-${new Date().toISOString().split('T')[0]}.pdf`;

      if (contentDisposition) {
        const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      // Create download blob for PDF
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      toast({
        title: 'Success',
        description: 'Backup history PDF exported successfully.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to export PDF.',
        variant: 'destructive',
      });
    } finally {
      setIsExportingPDF(false);
    }
  };

  // Enhanced download function with confirmation dialog and progress tracking
  const handleDownload = async (backup: any) => {
    // Open confirmation dialog immediately with loading state
    setConfirmDialog({
      isOpen: true,
      backup,
      fileSize: 0, // Will be updated when fetch completes
      filename: `${backup.site?.name || 'backup'}.zip`, // Default filename
      isLoading: true, // Show "Calculating file size..." message
    });

    try {
      // Fetch file size in background (non-blocking)
      const sizeResponse = await fetch(`/api/backups/${backup.id}/size`);

      if (sizeResponse.ok) {
        const sizeData = await sizeResponse.json();

        // Update dialog with actual file size and filename
        setConfirmDialog((prev) => ({
          ...prev,
          fileSize: sizeData.size,
          filename: sizeData.filename,
          isLoading: false,
        }));
      } else {
        // Size fetch failed, but still allow download
        console.warn('File size check failed, but allowing download to proceed');
        setConfirmDialog((prev) => ({
          ...prev,
          fileSize: 0, // Unknown size
          isLoading: false,
        }));
      }
    } catch (error) {
      // Size fetch failed, but still allow download to proceed
      console.warn('File size check error, but allowing download to proceed:', error);
      setConfirmDialog((prev) => ({
        ...prev,
        fileSize: 0, // Unknown size
        isLoading: false,
      }));
    }
  };

  // Perform the actual download with progress tracking
  const performDownload = async () => {
    const { backup, fileSize, filename } = confirmDialog;

    try {
      // Close confirmation dialog
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

      // Initialize download state
      const abortController = new AbortController();
      setDownloadState({
        isVisible: true,
        downloadedBytes: 0,
        filename,
        isCompleted: false,
        abortController,
      });

      // Start download with progress tracking
      const response = await fetch(`/api/backups/${backup.id}/download`, {
        method: 'GET',
        signal: abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`Download failed: ${response.statusText}`);
      }

      // Get response body reader for progress tracking
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      const chunks: Uint8Array[] = [];
      let receivedLength = 0;

      // Read data with progress updates
      while (true) {
        const { done, value } = await reader.read();

        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Update downloaded bytes
        setDownloadState((prev) => ({
          ...prev,
          downloadedBytes: receivedLength,
        }));
      }

      // Combine chunks into final blob
      const blob = new Blob(chunks);

      // Create download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      // Mark as completed
      setDownloadState((prev) => ({
        ...prev,
        isCompleted: true,
      }));

      toast({
        title: 'Download completed',
        description: `Backup for ${backup.site?.name || 'Unknown Site'} has been downloaded successfully.`,
        variant: 'default',
      });

      // Auto-hide progress after 3 seconds
      setTimeout(() => {
        setDownloadState((prev) => ({ ...prev, isVisible: false }));
      }, 3000);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        toast({
          title: 'Download cancelled',
          description: 'The download was cancelled by the user.',
          variant: 'default',
        });
      } else {
        console.error('Download error:', error);
        toast({
          title: 'Download failed',
          description: error instanceof Error ? error.message : 'Failed to download backup',
          variant: 'destructive',
        });
      }

      setDownloadState((prev) => ({ ...prev, isVisible: false }));
    }
  };

  // Function to fetch backup logs
  const fetchBackupLogs = async (backup: Backup) => {
    if (!backup.processId) {
      toast({
        title: 'Error',
        description: 'Process ID not found for this backup.',
        variant: 'destructive',
      });
      return;
    }

    setLogsLoading(true);
    try {
      const data: any = await apiRequest('GET', `/api/backup/status/${backup.processId}/logs`);

      if (data.success && data.logs) {
        // Handle the logs data structure that comes from the WordPress API
        setBackupLogs(Array.isArray(data.logs) ? data.logs : [data.logs]);
      } else {
        throw new Error(data.message || 'Failed to fetch logs');
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error?.message || 'Failed to fetch backup logs.',
        variant: 'destructive',
      });
      setBackupLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };

  // Fetch backups
  const { data: backups, isLoading: isLoadingBackups, refetch: refetchBackups } = useQuery<Backup[]>({
    queryKey: ['/api/backups'],
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch sites
  const { data: sites, isLoading: isLoadingSites, refetch: refetchSites } = useQuery<Site[]>({
    queryKey: ['/api/sites'],
    staleTime: 0,
    gcTime: 0,
  });

  // Fetch storage providers
  const { data: storageProviders, isLoading: isLoadingProviders, refetch: refetchProviders } = useQuery<StorageProvider[]>({
    queryKey: ['/api/storage-providers'],
    staleTime: 0,
    gcTime: 0,
  });

  // Format the size to human-readable format
  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return '--';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytes;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  // Get site by ID
  const getSite = (siteId: number): Site | undefined => {
    return sites && Array.isArray(sites)
      ? sites.find((site: Site) => site.id === siteId)
      : undefined;
  };

  // Get storage provider by ID
  const getStorageProvider = (providerId: number): StorageProvider | undefined => {
    return storageProviders && Array.isArray(storageProviders)
      ? storageProviders.find((provider: StorageProvider) => provider.id === providerId)
      : undefined;
  };

  // Get display-friendly backup type
  const getBackupTypeDisplay = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'files':
      case 'file':
        return 'File';
      case 'database':
      case 'db':
        return 'DB';
      case 'full':
      case 'all':
      default:
        return 'All';
    }
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <div className="inline-flex items-center rounded-full border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 dark:border-green-800 dark:bg-green-950/50 dark:text-green-300">
            <CheckCircle className="mr-1.5 h-3 w-3" />
            <span>Completed</span>
          </div>
        );
      case 'failed':
        return (
          <div className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 dark:border-red-800 dark:bg-red-950/50 dark:text-red-300">
            <XCircle className="mr-1.5 h-3 w-3" />
            <span>Failed</span>
          </div>
        );
      case 'in_progress':
        return (
          <div className="inline-flex items-center rounded-full border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300">
            <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
            <span>In Progress</span>
          </div>
        );
      case 'pending':
        return (
          <div className="inline-flex items-center rounded-full border border-yellow-200 bg-yellow-50 px-3 py-1.5 text-xs font-semibold text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300">
            <div className="mr-1.5 h-2 w-2 rounded-full bg-yellow-400 dark:bg-yellow-500" />
            <span>Pending</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center rounded-full border border-gray-200 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-800 dark:bg-gray-950/50 dark:text-gray-300">
            <div className="mr-1.5 h-2 w-2 rounded-full bg-gray-400 dark:bg-gray-500" />
            <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
        );
    }
  };

  // Filter backups
  const filteredBackups =
    backups && Array.isArray(backups)
      ? backups.filter((backup: Backup) => {
          const site = getSite(backup.siteId);
          const provider = backup.storageProviderId
            ? getStorageProvider(backup.storageProviderId)
            : null;

          // Apply site filter
          if (siteFilter !== 'all' && backup.siteId !== parseInt(siteFilter)) {
            return false;
          }

          // Apply status filter
          if (statusFilter !== 'all' && backup.status !== statusFilter) {
            return false;
          }

          // Apply type filter
          if (typeFilter !== 'all' && backup.backupType !== typeFilter) {
            return false;
          }

          // Apply search term
          if (searchTerm) {
            const searchLower = searchTerm.toLowerCase();
            const siteMatches =
              site &&
              (site.name.toLowerCase().includes(searchLower) ||
                site.url.toLowerCase().includes(searchLower));
            const providerMatches = provider && provider.name.toLowerCase().includes(searchLower);

            return siteMatches || providerMatches;
          }

          return true;
        })
      : [];

  // Sort backups by date (most recent first)
  const sortedBackups = [...(filteredBackups || [])].sort((a, b) => {
    const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
    const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
    return dateB - dateA;
  });

  // Pagination logic
  const totalItems = sortedBackups.length;
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedBackups = sortedBackups.slice(startIndex, endIndex);

  // Reset to first page when filters change
  const handleFilterChange = (filterSetter: (value: string) => void, value: string) => {
    filterSetter(value);
    setCurrentPage(1);
  };

  const isLoading = isLoadingBackups || isLoadingSites || isLoadingProviders;

  return (
    <div>
      <div className="mb-6 flex flex-col items-start justify-between md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup History</h1>
          <p className="text-muted-foreground">View and manage your site backups</p>
        </div>
        <div className="mt-4 flex space-x-2 md:mt-0">
          <Button variant="outline" onClick={handleExportPDF} disabled={isExportingPDF}>
            {isExportingPDF ? (
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
            ) : (
              <FileDown className="mr-1 h-4 w-4" />
            )}
            {isExportingPDF ? 'Exporting...' : 'Export PDF'}
          </Button>
          <Button
            onClick={async () => {
              try {
                // Use direct refetch methods for immediate refresh
                await Promise.all([
                  refetchBackups(),
                  refetchSites(),
                  refetchProviders()
                ]);
                
                toast({
                  title: 'Success',
                  description: 'All data refreshed successfully.',
                });
              } catch (error) {
                toast({
                  title: 'Error',
                  description: 'Failed to refresh data. Please try again.',
                  variant: 'destructive',
                });
              }
            }}
            disabled={isLoading}
          >
            <RefreshCw className={`mr-1 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle>Filter Options</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search backups..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <Select
              value={siteFilter}
              onValueChange={(value) => handleFilterChange(setSiteFilter, value)}
            >
              <SelectTrigger>
                <div className="flex items-center">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by site" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sites</SelectItem>
                {sites && Array.isArray(sites)
                  ? sites.map((site: Site) => (
                      <SelectItem key={site.id} value={site.id.toString()}>
                        {site.name}
                      </SelectItem>
                    ))
                  : null}
              </SelectContent>
            </Select>

            <Select
              value={typeFilter}
              onValueChange={(value) => handleFilterChange(setTypeFilter, value)}
            >
              <SelectTrigger>
                <div className="flex items-center">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by type" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="full">All</SelectItem>
                <SelectItem value="files">File</SelectItem>
                <SelectItem value="database">DB</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={statusFilter}
              onValueChange={(value) => handleFilterChange(setStatusFilter, value)}
            >
              <SelectTrigger>
                <div className="flex items-center">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </div>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-gray-200 bg-white shadow-sm dark:border-gray-700 dark:bg-gray-900">
        <CardHeader className="border-b border-gray-200 bg-gray-50 pb-4 dark:border-gray-700 dark:bg-gray-800">
          <CardTitle className="flex items-center gap-2 text-gray-900 dark:text-gray-100">
            <FileText className="h-5 w-5 text-primary" />
            Backup Results
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center py-16">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Loading backup history...</p>
              </div>
            </div>
          ) : paginatedBackups.length === 0 ? (
            <div className="py-16 text-center">
              <div className="flex flex-col items-center gap-3">
                <FileText className="h-12 w-12 text-gray-400 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                  No backup records found
                </h3>
                <p className="max-w-md text-sm text-gray-500 dark:text-gray-400">
                  No backup records match your current search criteria. Try adjusting your filters
                  or create a new backup.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden bg-white dark:bg-gray-900">
              <Table>
                <TableHeader>
                  <TableRow className="border-b border-gray-200 bg-gray-100 transition-colors hover:bg-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:hover:bg-gray-700">
                    <TableHead className="h-12 px-6 font-semibold text-gray-700 dark:text-gray-300">
                      Site
                    </TableHead>
                    <TableHead className="h-12 font-semibold text-gray-700 dark:text-gray-300">
                      Type
                    </TableHead>
                    <TableHead className="h-12 font-semibold text-gray-700 dark:text-gray-300">
                      Status
                    </TableHead>
                    <TableHead className="h-12 font-semibold text-gray-700 dark:text-gray-300">
                      Size
                    </TableHead>
                    <TableHead className="h-12 font-semibold text-gray-700 dark:text-gray-300">
                      Files
                    </TableHead>
                    <TableHead className="h-12 font-semibold text-gray-700 dark:text-gray-300">
                      Storage Provider
                    </TableHead>
                    <TableHead className="h-12 font-semibold text-gray-700 dark:text-gray-300">
                      Started
                    </TableHead>
                    <TableHead className="h-12 font-semibold text-gray-700 dark:text-gray-300">
                      Completed
                    </TableHead>
                    <TableHead className="h-12 px-6 text-right font-semibold text-gray-700 dark:text-gray-300">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBackups.map((backup: Backup) => {
                    const site = getSite(backup.siteId);
                    const provider = backup.storageProviderId
                      ? getStorageProvider(backup.storageProviderId)
                      : null;

                    return (
                      <TableRow
                        key={backup.id}
                        className="group h-20 border-b border-gray-100 bg-white transition-colors hover:bg-blue-50 dark:border-gray-700 dark:bg-gray-900 dark:hover:bg-gray-800"
                      >
                        <TableCell className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-gray-900 transition-colors group-hover:text-primary dark:text-gray-100">
                              {site?.name || 'Unknown Site'}
                            </div>
                            <div className="flex items-center gap-1 text-sm text-gray-500 transition-colors group-hover:text-gray-600 dark:text-gray-400 dark:group-hover:text-gray-300">
                              <ExternalLink className="h-3 w-3" />
                              <span className="max-w-48 truncate">{site?.url || '--'}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div
                            className={`inline-flex items-center rounded-full px-3 py-1.5 text-xs font-semibold shadow-sm transition-all ${
                              backup.backupType === 'files' || backup.backupType === 'file'
                                ? 'border border-blue-200 bg-blue-50 text-blue-700 group-hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300 dark:group-hover:bg-blue-900/50'
                                : backup.backupType === 'database' || backup.backupType === 'db'
                                  ? 'border border-purple-200 bg-purple-50 text-purple-700 group-hover:bg-purple-100 dark:border-purple-800 dark:bg-purple-950/50 dark:text-purple-300 dark:group-hover:bg-purple-900/50'
                                  : 'border border-emerald-200 bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 dark:group-hover:bg-emerald-900/50'
                            }`}
                          >
                            {getBackupTypeDisplay(backup.backupType)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="space-y-1">
                            {getStatusBadge(backup.status)}
                            {backup.error && (
                              <div
                                className="max-w-32 truncate text-xs text-red-600 dark:text-red-400"
                                title={backup.error}
                              >
                                {backup.error}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-semibold text-gray-900 transition-colors group-hover:text-primary dark:text-gray-100">
                            {formatSize(backup.filesize || null)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-semibold text-gray-900 transition-colors group-hover:text-primary dark:text-gray-100">
                            {backup.fileCount ? backup.fileCount.toLocaleString() : '--'}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-medium text-gray-700 transition-colors group-hover:text-gray-900 dark:text-gray-300 dark:group-hover:text-gray-100">
                            {provider?.name || 'Unknown Provider'}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {backup.startedAt ? (
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium text-gray-900 transition-colors group-hover:text-primary dark:text-gray-100">
                                {format(new Date(backup.startedAt), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {format(new Date(backup.startedAt), 'HH:mm:ss')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {backup.completedAt ? (
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium text-gray-900 transition-colors group-hover:text-primary dark:text-gray-100">
                                {format(new Date(backup.completedAt), 'MMM d, yyyy')}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {format(new Date(backup.completedAt), 'HH:mm:ss')}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="px-6 py-4 text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 rounded-full transition-colors hover:bg-gray-100 dark:hover:bg-gray-700"
                              >
                                <MoreVertical className="h-4 w-4 text-gray-500 transition-colors group-hover:text-primary dark:text-gray-400" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                              align="end"
                              className="w-48 border border-gray-200 bg-white shadow-lg dark:border-gray-700 dark:bg-gray-800"
                            >
                              {backup.status === 'completed' && (
                                <DropdownMenuItem
                                  onClick={() => handleDownload(backup)}
                                  className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                                >
                                  <Download className="mr-2 h-4 w-4" />
                                  <span>Download</span>
                                </DropdownMenuItem>
                              )}
                              {/* {backup.status === "failed" && (
                                <DropdownMenuItem
                                  onClick={() => retryMutation.mutate(backup)}
                                  disabled={retryMutation.isPending}
                                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                                >
                                  <RefreshCw className={`mr-2 h-4 w-4 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                                  <span>{retryMutation.isPending ? 'Retrying...' : 'Retry'}</span>
                                </DropdownMenuItem>
                              )} */}
                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedBackup(backup);
                                  setShowDetailsDialog(true);
                                }}
                                className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                              >
                                <Eye className="mr-2 h-4 w-4" />
                                <span>View Details</span>
                              </DropdownMenuItem>

                              <DropdownMenuItem
                                onClick={() => {
                                  setSelectedBackup(backup);
                                  setShowLogsDialog(true);
                                  fetchBackupLogs(backup);
                                }}
                                className="text-gray-700 hover:text-gray-900 dark:text-gray-300 dark:hover:text-gray-100"
                              >
                                <FileText className="mr-2 h-4 w-4" />
                                <span>View Logs</span>
                              </DropdownMenuItem>

                              {backup.backupType === 'incremental' && (
                                <DropdownMenuItem>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  <span>View Backup Chain</span>
                                </DropdownMenuItem>
                              )}

                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-red-600"
                                onClick={() => {
                                  setSelectedBackup(backup);
                                  setShowDeleteDialog(true);
                                }}
                              >
                                <Trash className="mr-2 h-4 w-4" />
                                <span>Delete</span>
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination */}
          {paginatedBackups.length > 0 && totalPages > 1 && (
            <div className="flex items-center justify-between px-2 py-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, totalItems)} of {totalItems} results
              </div>
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      onClick={() => currentPage > 1 && setCurrentPage(currentPage - 1)}
                      className={
                        currentPage <= 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                      }
                    />
                  </PaginationItem>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNumber;
                    if (totalPages <= 5) {
                      pageNumber = i + 1;
                    } else if (currentPage <= 3) {
                      pageNumber = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNumber = totalPages - 4 + i;
                    } else {
                      pageNumber = currentPage - 2 + i;
                    }

                    return (
                      <PaginationItem key={pageNumber}>
                        <PaginationLink
                          onClick={() => setCurrentPage(pageNumber)}
                          isActive={currentPage === pageNumber}
                          className="cursor-pointer"
                        >
                          {pageNumber}
                        </PaginationLink>
                      </PaginationItem>
                    );
                  })}

                  <PaginationItem>
                    <PaginationNext
                      onClick={() => currentPage < totalPages && setCurrentPage(currentPage + 1)}
                      className={
                        currentPage >= totalPages
                          ? 'pointer-events-none opacity-50'
                          : 'cursor-pointer'
                      }
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Backup</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this backup? This action cannot be undone.
              {selectedBackup && (
                <div className="mt-2 rounded-md bg-muted p-3">
                  <p className="text-sm">
                    <strong>Backup ID:</strong> {selectedBackup.id}
                  </p>
                  {selectedBackup.filename && (
                    <p className="text-sm">
                      <strong>File:</strong> {selectedBackup.filename}
                    </p>
                  )}
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedBackup && deleteMutation.mutate(selectedBackup.id)}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteMutation.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Backup Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-h-[80vh] max-w-2xl overflow-y-auto border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Backup Details</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Detailed information about this backup
            </DialogDescription>
          </DialogHeader>
          {selectedBackup && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                    Basic Information
                  </h4>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">ID:</strong>{' '}
                      {selectedBackup.id}
                    </p>
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">Type:</strong>{' '}
                      {getBackupTypeDisplay(selectedBackup.backupType)}
                    </p>
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">Status:</strong>{' '}
                      {selectedBackup.status}
                    </p>
                    {selectedBackup.processId && (
                      <p>
                        <strong className="text-gray-900 dark:text-gray-100">Process ID:</strong>{' '}
                        {selectedBackup.processId}
                      </p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">
                    File Details
                  </h4>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {selectedBackup.filename && (
                      <p>
                        <strong className="text-gray-900 dark:text-gray-100">Filename:</strong>{' '}
                        {selectedBackup.filename}
                      </p>
                    )}
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">Size:</strong>{' '}
                      {formatSize(selectedBackup.filesize || null)}
                    </p>
                    {selectedBackup.storagePath && (
                      <p>
                        <strong className="text-gray-900 dark:text-gray-100">Storage Path:</strong>{' '}
                        {selectedBackup.storagePath}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Timeline</h4>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p>
                    <strong className="text-gray-900 dark:text-gray-100">Created:</strong>{' '}
                    {format(new Date(selectedBackup.createdAt), 'PPpp')}
                  </p>
                  {selectedBackup.startedAt && (
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">Started:</strong>{' '}
                      {format(new Date(selectedBackup.startedAt), 'PPpp')}
                    </p>
                  )}
                  {selectedBackup.completedAt && (
                    <p>
                      <strong className="text-gray-900 dark:text-gray-100">Completed:</strong>{' '}
                      {format(new Date(selectedBackup.completedAt), 'PPpp')}
                    </p>
                  )}
                </div>
              </div>

              {selectedBackup.metadata && (
                <div>
                  <h4 className="mb-2 font-semibold text-gray-900 dark:text-gray-100">Metadata</h4>
                  <pre className="overflow-x-auto rounded-md border border-gray-200 bg-gray-100 p-3 text-xs text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-200">
                    {JSON.stringify(JSON.parse(selectedBackup.metadata), null, 2)}
                  </pre>
                </div>
              )}

              {selectedBackup.error && (
                <div>
                  <h4 className="mb-2 font-semibold text-red-600 dark:text-red-400">
                    Error Details
                  </h4>
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
                    <p className="text-sm text-red-800 dark:text-red-200">{selectedBackup.error}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Backup Logs Dialog */}
      <Dialog open={showLogsDialog} onOpenChange={setShowLogsDialog}>
        <DialogContent className="max-h-[80vh] max-w-4xl overflow-y-auto border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-900">
          <DialogHeader>
            <DialogTitle className="text-gray-900 dark:text-gray-100">Backup Logs</DialogTitle>
            <DialogDescription className="text-gray-600 dark:text-gray-400">
              Process logs for this backup operation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <span className="ml-2 text-gray-700 dark:text-gray-300">Loading logs...</span>
              </div>
            ) : backupLogs.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">
                    Process Logs ({backupLogs.length} entries)
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedBackup && fetchBackupLogs(selectedBackup)}
                    className="border-gray-300 text-gray-700 dark:border-gray-600 dark:text-gray-300"
                  >
                    <RefreshCw className="mr-1 h-4 w-4" />
                    Refresh
                  </Button>
                </div>
                <div className="max-h-96 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-4 font-mono text-sm text-green-400 dark:bg-black">
                  {(() => {
                    // Parse the logs data - expecting a JSON object with timestamp keys
                    let parsedLogs = [];

                    try {
                      console.log('Raw backup logs:', backupLogs);

                      // Handle the logs data
                      let logData: Record<string, any> = {};

                      if (backupLogs.length === 1 && typeof backupLogs[0] === 'string') {
                        console.log('Parsing single string log:', backupLogs[0]);
                        logData = JSON.parse(backupLogs[0]);
                      } else if (backupLogs.length > 0) {
                        console.log('Processing multiple logs:', backupLogs);
                        // If multiple entries, try to parse each one
                        backupLogs.forEach((log, index) => {
                          console.log(`Processing log ${index}:`, log);
                          if (typeof log === 'string') {
                            try {
                              const parsed = JSON.parse(log);
                              logData = { ...logData, ...parsed };
                            } catch (parseError) {
                              console.error(`Error parsing log ${index}:`, parseError);
                              // Treat as plain text
                              (logData as Record<string, any>)[`entry_${index}`] = {
                                status: 'INFO',
                                state: 'LOG',
                                message: log,
                              };
                            }
                          } else if (typeof log === 'object' && log !== null) {
                            // If already an object, merge it
                            logData = { ...logData, ...(log as Record<string, any>) };
                          }
                        });
                      }

                      console.log('Parsed log data:', logData);

                      // Convert the object to an array of log entries
                      // Each key is a timestamp, each value is the log entry
                      parsedLogs = Object.entries(logData)
                        .map(([timestamp, logEntry]) => {
                          console.log(
                            `Processing entry - timestamp: ${timestamp}, entry:`,
                            logEntry
                          );
                          const entry = logEntry as Record<string, any>;
                          return {
                            timestamp,
                            status: entry.status || '',
                            state: entry.state || '',
                            message: entry.message || entry.progress || '',
                            ...entry,
                          };
                        })
                        .sort((a, b) => a.timestamp.localeCompare(b.timestamp));

                      console.log('Final parsed logs:', parsedLogs);
                    } catch (e) {
                      console.error('Error parsing logs:', e);
                      console.log('Falling back to simple parsing');
                      // Fallback: treat each log as a separate entry
                      parsedLogs = backupLogs.map((log, index) => ({
                        timestamp: `fallback_${index}`,
                        message: typeof log === 'string' ? log : JSON.stringify(log),
                        status: 'ERROR',
                        state: 'PARSE_ERROR',
                      }));
                    }

                    return parsedLogs.map((logEntry, index) => {
                      // Parse timestamp format: "2025-08-06_12-05-24" to readable format
                      const formatTimestamp = (timestamp: string) => {
                        try {
                          if (timestamp.includes('_')) {
                            const [date, time] = timestamp.split('_');
                            const [year, month, day] = date.split('-');
                            const [hour, minute, second] = time.split('-');
                            const dateObj = new Date(
                              parseInt(year),
                              parseInt(month) - 1,
                              parseInt(day),
                              parseInt(hour),
                              parseInt(minute),
                              parseInt(second)
                            );
                            return {
                              date: dateObj.toLocaleDateString(),
                              time: dateObj.toLocaleTimeString(),
                            };
                          }
                          const dateObj = new Date(timestamp);
                          return {
                            date: dateObj.toLocaleDateString(),
                            time: dateObj.toLocaleTimeString(),
                          };
                        } catch (e) {
                          return {
                            date: '',
                            time: timestamp,
                          };
                        }
                      };

                      const { date, time } = formatTimestamp(logEntry.timestamp);
                      const message = logEntry.message || 'No message';
                      const status = logEntry.status || '';
                      const state = logEntry.state || '';

                      return (
                        <div key={index} className="mb-2 flex flex-wrap">
                          <span className="mr-3 whitespace-nowrap text-cyan-400">
                            [{date} {time}]
                          </span>
                          {status && (
                            <span className="mr-2 font-semibold text-yellow-400">[{status}]</span>
                          )}
                          {state && <span className="mr-2 text-blue-400">{state}:</span>}
                          <span className="flex-1 text-green-400">{message}</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No logs available for this backup
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Download Confirmation Dialog */}
      <DownloadConfirmDialog
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, isOpen: open }))}
        onConfirm={performDownload}
        siteName={confirmDialog.backup?.site?.name || 'Unknown Site'}
        fileSize={confirmDialog.fileSize}
        filename={confirmDialog.filename}
        isLoading={confirmDialog.isLoading}
      />

      {/* Download Progress Component */}
      <DownloadProgress
        isVisible={downloadState.isVisible}
        downloadedBytes={downloadState.downloadedBytes}
        filename={downloadState.filename}
        isCompleted={downloadState.isCompleted}
        onCancel={() => {
          downloadState.abortController?.abort();
          setDownloadState((prev) => ({ ...prev, isVisible: false }));
        }}
        onMinimize={() => setDownloadState((prev) => ({ ...prev, isVisible: false }))}
        onClose={() => setDownloadState((prev) => ({ ...prev, isVisible: false }))}
      />
    </div>
  );
};

export default BackupHistory;
