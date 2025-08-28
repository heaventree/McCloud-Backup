import { useQuery } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { DashboardStats, Backup, Site, StorageProvider } from '@/lib/types';
import StatsCard from '@/components/dashboard/stats-card';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import AddSiteForm from '@/components/sites/add-site-form';
import NextStepsModal from '@/components/sites/next-steps-modal';
import { useState } from 'react';
import {
  Plus,
  Loader2,
  Server,
  HardDrive,
  CheckCircle,
  AlertCircle,
  Download,
  MoreHorizontal,
  Clock,
  ArrowRight,
  Share2,
  FileUp,
  Sliders,
  FileText,
  Info,
  Terminal,
  Calendar,
  Database,
  GanttChart,
} from 'lucide-react';
import { format, formatDistanceToNow } from 'date-fns';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { toast } from '@/hooks/use-toast';
import { DownloadProgress } from '@/components/DownloadProgress';
import { DownloadConfirmDialog } from '@/components/DownloadConfirmDialog';

const Dashboard = () => {
  const [, setLocation] = useLocation();
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [selectedBackup, setSelectedBackup] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isLogsOpen, setIsLogsOpen] = useState(false);
  const [showNextSteps, setShowNextSteps] = useState(false);
  const [newSiteForNextSteps, setNewSiteForNextSteps] = useState<Site | null>(null);

  // Download state
  const [downloadState, setDownloadState] = useState<{
    isVisible: boolean;
    progress: number;
    downloadedBytes: number;
    totalBytes: number;
    filename: string;
    isCompleted: boolean;
    abortController?: AbortController;
  }>({
    isVisible: false,
    progress: 0,
    downloadedBytes: 0,
    totalBytes: 0,
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

  const {
    data: stats,
    isLoading,
    isError,
  } = useQuery<DashboardStats>({
    queryKey: ['/api/dashboard/stats'],
  });

  // Fetch recent backups
  const { data: backups, isLoading: isLoadingBackups } = useQuery({
    queryKey: ['/api/backups/recent'],
  });

  // Fetch sites for enriching backup data
  const { data: sites } = useQuery({
    queryKey: ['/api/sites'],
  });

  // Fetch storage providers for enriching backup data
  const { data: storageProviders } = useQuery({
    queryKey: ['/api/storage-providers'],
  });

  // Fetch storage trend data for dynamic change display
  const { data: storageTrend, isLoading: isLoadingStorageTrend } = useQuery({
    queryKey: ['/api/dashboard/storage-trend', 'week'],
    queryFn: () => fetch('/api/dashboard/storage-trend?period=week').then((res) => res.json()),
  });

  // Format the size to human-readable format
  const formatSize = (bytes: number | null | undefined) => {
    // Handle undefined, null, or NaN values
    if (bytes === undefined || bytes === null || isNaN(bytes)) {
      return '0 B';
    }

    // Ensure bytes is treated as a number
    const bytesNum = Number(bytes);
    if (bytesNum === 0) return '0 B';

    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let size = bytesNum;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
      size /= 1024;
      unitIndex++;
    }

    return `${size.toFixed(2)} ${units[unitIndex]}`;
  };

  // Get status badge color
  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <span className="badge badge-success">Completed</span>;
      case 'failed':
        return <span className="badge badge-danger">Failed</span>;
      case 'in_progress':
        return <span className="badge badge-info">In Progress</span>;
      default:
        return <span className="badge">{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
    }
  };

  // Join backups with site and storage provider data
  const joinedBackups =
    backups &&
    sites &&
    storageProviders &&
    Array.isArray(backups) &&
    Array.isArray(sites) &&
    Array.isArray(storageProviders)
      ? backups.map((backup: Backup) => ({
          ...backup,
          site: sites.find((site: Site) => site.id === backup.siteId),
          storageProvider: storageProviders.find(
            (provider: StorageProvider) => provider.id === backup.storageProviderId
          ),
        }))
      : [];

  // Handler for viewing backup details
  const handleViewDetails = (backup: any) => {
    setSelectedBackup(backup);
    setIsDetailsOpen(true);
  };

  // Handler for downloading logs
  const handleDownloadLogs = (backup: any) => {
    setSelectedBackup(backup);
    setIsLogsOpen(true);

    // In a real app, we would fetch logs from the server
    // For now, we'll show a success message
    setTimeout(() => {
      toast({
        title: 'Logs downloaded',
        description: `Backup logs for ${backup.site?.name || 'Unknown Site'} have been downloaded.`,
        variant: 'default',
      });
      setIsLogsOpen(false);
    }, 1500);
  };

  // Handler for downloading backup files
  const handleDownloadBackup = async (backup: any) => {
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

  // Handler for confirmed download with progress tracking
  const performDownload = async () => {
    const { backup, fileSize, filename } = confirmDialog;

    try {
      // Close confirmation dialog
      setConfirmDialog((prev) => ({ ...prev, isOpen: false }));

      // Initialize download state
      const abortController = new AbortController();
      setDownloadState({
        isVisible: true,
        progress: 0,
        downloadedBytes: 0,
        totalBytes: fileSize,
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

        // Update progress (handle case where fileSize might be unknown/0)
        const progress = fileSize > 0 ? (receivedLength / fileSize) * 100 : 0;
        setDownloadState((prev) => ({
          ...prev,
          progress: fileSize > 0 ? Math.min(progress, 100) : 0, // Show indeterminate progress if size unknown
          downloadedBytes: receivedLength,
          totalBytes: fileSize > 0 ? fileSize : receivedLength, // Update totalBytes if size was unknown
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
        progress: 100,
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

  // Download control handlers
  const cancelDownload = () => {
    if (downloadState.abortController) {
      downloadState.abortController.abort();
    }
    setDownloadState((prev) => ({ ...prev, isVisible: false }));
  };

  const minimizeDownload = () => {
    // Progress component handles its own minimize state
  };

  const closeDownload = () => {
    setDownloadState((prev) => ({ ...prev, isVisible: false }));
  };

  return (
    <div>
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex flex-col justify-center">
          <h4 className="text-2xl font-semibold leading-none text-gray-800 dark:text-gray-100">
            Dashboard
          </h4>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Welcome to McCloud Backup dashboard
          </p>
        </div>
        <div className="flex items-center space-x-3">
          <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
            <DialogTrigger asChild>
              <Button className="btn-primary flex items-center">
                <Plus className="mr-1.5 h-4 w-4" />
                Add Site
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add a new site</DialogTitle>
              </DialogHeader>
              <AddSiteForm
                onSuccess={(site) => {
                  setIsAddingSite(false);
                  if (site) {
                    setNewSiteForNextSteps(site);
                    setShowNextSteps(true);
                  }
                }}
              />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats cards */}
      <div className="mb-5">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : isError ? (
          <div className="py-8 text-center text-red-500">Failed to load dashboard statistics</div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatsCard
              title="CONNECTED SITES"
              value={stats?.totalSites || 0}
              icon={Server}
              iconColor="text-blue-600"
              changeText="+2 since last month"
              changeColor="text-green-600"
            />

            <StatsCard
              title="STORAGE USAGE"
              value={formatSize(stats?.totalStorage || 0)}
              icon={HardDrive}
              iconColor="text-indigo-600"
              changeText={
                isLoadingStorageTrend
                  ? 'Loading...'
                  : storageTrend?.changeFormatted
                    ? `${storageTrend.changeFormatted} since last ${storageTrend.period}`
                    : 'No change this week'
              }
              changeColor={
                isLoadingStorageTrend
                  ? 'text-gray-500'
                  : storageTrend?.trend === 'up'
                    ? 'text-green-600'
                    : storageTrend?.trend === 'down'
                      ? 'text-red-600'
                      : 'text-gray-500'
              }
            />

            <StatsCard
              title="SUCCESSFUL BACKUPS"
              value={stats?.completedBackups || 0}
              icon={CheckCircle}
              iconColor="text-green-600"
              changeText={`${stats ? Math.round((stats.completedBackups / (stats.completedBackups + stats.failedBackups || 1)) * 100) : 0}% success rate`}
              changeColor="text-green-600"
            />

            <StatsCard
              title="FAILED BACKUPS"
              value={stats?.failedBackups || 0}
              icon={AlertCircle}
              iconColor="text-red-600"
              changeText="Action required"
              changeColor="text-red-600"
            />
          </div>
        )}
      </div>

      {/* Recent backup activity */}
      <div className="mb-8">
        <div className="card mb-6">
          <div className="flex items-center justify-between border-b border-gray-100 p-5 dark:border-gray-700">
            <h5 className="card-title m-0 dark:text-gray-100">Recent Backup Activity</h5>
            <Button
              variant="ghost"
              size="sm"
              className="flex items-center text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
              onClick={() => setLocation('/backup-history')}
            >
              View All
              <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>

          <div className="card-body p-0">
            {isLoadingBackups ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : joinedBackups.length === 0 ? (
              <div className="py-8 text-center text-gray-500 dark:text-gray-400">
                No recent backups found
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th className="dark:text-gray-300">Site</th>
                      <th className="dark:text-gray-300">Status</th>
                      <th className="dark:text-gray-300">Size</th>
                      <th className="dark:text-gray-300">Destination</th>
                      <th className="dark:text-gray-300">Timestamp</th>
                      <th className="text-right dark:text-gray-300">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {joinedBackups.slice(0, 5).map((backup: any) => (
                      <tr key={backup.id}>
                        <td>
                          <div className="flex items-center">
                            <div className="mr-3 flex h-8 w-8 items-center justify-center rounded bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                              <Share2 className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-800 dark:text-gray-200">
                                {backup.site?.name || 'Unknown Site'}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {backup.site?.url || 'Unknown URL'}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td>{getStatusBadge(backup.status)}</td>
                        <td>{backup.size ? formatSize(backup.size) : '--'}</td>
                        <td>
                          <div className="flex items-center">
                            <div className="mr-2 flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400">
                              <FileUp className="h-3 w-3" />
                            </div>
                            <span className="dark:text-gray-300">
                              {backup.storageProvider?.name || 'Unknown'}
                            </span>
                          </div>
                        </td>
                        <td>
                          {backup.startedAt ? (
                            <div className="flex items-center">
                              <Clock className="mr-1.5 h-4 w-4 text-gray-400" />
                              <div>
                                <div className="dark:text-gray-300">
                                  {format(new Date(backup.startedAt), 'MMM d, yy')}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {formatDistanceToNow(new Date(backup.startedAt), {
                                    addSuffix: true,
                                  })}
                                </div>
                              </div>
                            </div>
                          ) : (
                            '--'
                          )}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {backup.status === 'completed' ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                                onClick={() => handleDownloadBackup(backup)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-gray-500 dark:text-gray-400"
                                >
                                  <Sliders className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[160px]">
                                <DropdownMenuItem onClick={() => handleViewDetails(backup)}>
                                  View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => handleDownloadLogs(backup)}>
                                  Download Logs
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Backup Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Backup Details
            </DialogTitle>
            <DialogDescription>Detailed information about the selected backup</DialogDescription>
          </DialogHeader>

          {selectedBackup && (
            <div className="grid gap-5 py-4">
              <div className="grid grid-cols-4 gap-3">
                <div className="col-span-4 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-200 pb-3 dark:border-gray-700">
                    <div className="flex items-center space-x-2">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                        <Share2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h4 className="text-lg font-medium text-gray-800 dark:text-gray-200">
                          {selectedBackup.site?.name || 'Unknown Site'}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {selectedBackup.site?.url || 'Unknown URL'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-800 dark:text-gray-200">
                        Backup ID
                      </div>
                      <div className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        #{selectedBackup.id}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </h5>
                      <div>{getStatusBadge(selectedBackup.status)}</div>
                    </div>
                    <div>
                      <h5 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Type
                      </h5>
                      <div className="capitalize text-gray-800 dark:text-gray-200">
                        {selectedBackup.type || 'Full Backup'}
                      </div>
                    </div>
                    <div>
                      <h5 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Size
                      </h5>
                      <div className="text-gray-800 dark:text-gray-200">
                        {selectedBackup.size ? formatSize(selectedBackup.size) : '--'}
                      </div>
                    </div>
                    <div>
                      <h5 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Files
                      </h5>
                      <div className="text-gray-800 dark:text-gray-200">
                        {selectedBackup.fileCount || 0} files
                      </div>
                    </div>
                    <div>
                      <h5 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Storage
                      </h5>
                      <div className="flex items-center text-gray-800 dark:text-gray-200">
                        <FileUp className="mr-1.5 h-4 w-4 text-gray-400" />
                        <span>{selectedBackup.storageProvider?.name || 'Unknown'}</span>
                      </div>
                    </div>
                    <div>
                      <h5 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Started
                      </h5>
                      <div className="flex items-center text-gray-800 dark:text-gray-200">
                        <Calendar className="mr-1.5 h-4 w-4 text-gray-400" />
                        <span>
                          {selectedBackup.startedAt
                            ? format(new Date(selectedBackup.startedAt), 'MMM d, yyyy HH:mm')
                            : '--'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h5 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Completed
                      </h5>
                      <div className="flex items-center text-gray-800 dark:text-gray-200">
                        <Calendar className="mr-1.5 h-4 w-4 text-gray-400" />
                        <span>
                          {selectedBackup.completedAt
                            ? format(new Date(selectedBackup.completedAt), 'MMM d, yyyy HH:mm')
                            : 'In Progress'}
                        </span>
                      </div>
                    </div>
                    <div>
                      <h5 className="mb-1 text-sm font-medium text-gray-500 dark:text-gray-400">
                        Database
                      </h5>
                      <div className="flex items-center text-gray-800 dark:text-gray-200">
                        <Database className="mr-1.5 h-4 w-4 text-gray-400" />
                        <span>Included</span>
                      </div>
                    </div>
                  </div>

                  {selectedBackup.status === 'failed' && selectedBackup.error && (
                    <div className="mt-2 rounded-md bg-red-50 p-3 text-sm text-red-600 dark:bg-red-900/10 dark:text-red-400">
                      <div className="mb-1 font-medium">Error Details</div>
                      <code className="block whitespace-pre-wrap">{selectedBackup.error}</code>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDetailsOpen(false)}>
              Close
            </Button>
            {selectedBackup && selectedBackup.status === 'completed' && (
              <Button onClick={() => handleDownloadLogs(selectedBackup)}>
                <FileText className="mr-2 h-4 w-4" />
                Download Logs
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Download Logs Dialog */}
      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Terminal className="h-5 w-5 text-blue-500" />
              Downloading Logs
            </DialogTitle>
            <DialogDescription>
              {selectedBackup
                ? `Downloading logs for ${selectedBackup.site?.name || 'Unknown Site'}`
                : 'Please wait...'}
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center py-6">
            <Loader2 className="mb-4 h-10 w-10 animate-spin text-blue-600" />
            <p className="text-center text-gray-600 dark:text-gray-400">
              Fetching and preparing logs for download.
              <br />
              This may take a moment...
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Download Confirmation Dialog */}
      <DownloadConfirmDialog
        isOpen={confirmDialog.isOpen}
        onOpenChange={(open) => setConfirmDialog((prev) => ({ ...prev, isOpen: open }))}
        filename={confirmDialog.filename}
        fileSize={confirmDialog.fileSize}
        siteName={confirmDialog.backup?.site?.name || 'Unknown Site'}
        onConfirm={performDownload}
        isLoading={confirmDialog.isLoading}
      />

      {/* Download Progress */}
      <DownloadProgress
        isVisible={downloadState.isVisible}
        progress={downloadState.progress}
        downloadedBytes={downloadState.downloadedBytes}
        totalBytes={downloadState.totalBytes}
        filename={downloadState.filename}
        isCompleted={downloadState.isCompleted}
        onCancel={cancelDownload}
        onMinimize={minimizeDownload}
        onClose={closeDownload}
      />

      {/* Next Steps Modal */}
      <NextStepsModal
        open={showNextSteps}
        onOpenChange={setShowNextSteps}
        site={newSiteForNextSteps}
      />
    </div>
  );
};

export default Dashboard;
