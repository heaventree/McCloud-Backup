import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
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
} from "@/components/ui/alert-dialog";
import { Site, Backup, StorageProvider } from "@/lib/types";
import { Search, Download, RefreshCw, MoreVertical, FileDown, Trash, Filter, Loader2, ExternalLink, XCircle, CheckCircle, FileText, Eye } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";

const BackupHistory = () => {
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [itemsPerPage] = useState<number>(10);
  
  // Dialog states
  const [selectedBackup, setSelectedBackup] = useState<Backup | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [showLogsDialog, setShowLogsDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [backupLogs, setBackupLogs] = useState<any[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  
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
        title: "Success",
        description: "Backup deleted successfully.",
      });
      setShowDeleteDialog(false);
      setSelectedBackup(null);
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to delete backup.",
        variant: "destructive",
      });
    }
  });

  const retryMutation = useMutation({
    mutationFn: async (backup: Backup) => {
      return apiRequest('POST', `/api/backups/${backup.id}/retry`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
      toast({
        title: "Success",
        description: "Backup retry initiated successfully.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error?.message || "Failed to retry backup.",
        variant: "destructive",
      });
    }
  });

  // Function to handle backup download
  const handleDownload = async (backup: Backup) => {
    try {
      const site = getSite(backup.siteId);
      if (!backup.storagePath || !backup.storageProviderId) {
        toast({
          title: "Error",
          description: "Backup file path or storage provider not found.",
          variant: "destructive",
        });
        return;
      }

      // Call download API endpoint
      const response = await fetch(`/api/backups/${backup.id}/download`, {
        method: 'GET',
        credentials: 'include',
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: 'Download failed' }));
        throw new Error(error.message || 'Download failed');
      }

      // Get filename from response headers or use backup filename
      const contentDisposition = response.headers.get('content-disposition');
      let filename = backup.filename || `backup-${backup.id}.zip`;
      
      if (contentDisposition) {
        const matches = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (matches && matches[1]) {
          filename = matches[1].replace(/['"]/g, '');
        }
      }

      // Create download blob
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
        title: "Success",
        description: "Backup download started.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error?.message || "Failed to download backup.",
        variant: "destructive",
      });
    }
  };

  // Function to fetch backup logs
  const fetchBackupLogs = async (backup: Backup) => {
    if (!backup.processId) {
      toast({
        title: "Error",
        description: "Process ID not found for this backup.",
        variant: "destructive",
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
        title: "Error",
        description: error?.message || "Failed to fetch backup logs.",
        variant: "destructive",
      });
      setBackupLogs([]);
    } finally {
      setLogsLoading(false);
    }
  };
  
  // Fetch backups
  const { data: backups, isLoading: isLoadingBackups } = useQuery<Backup[]>({
    queryKey: ["/api/backups"],
  });
  
  // Fetch sites
  const { data: sites, isLoading: isLoadingSites } = useQuery<Site[]>({
    queryKey: ["/api/sites"],
  });
  
  // Fetch storage providers
  const { data: storageProviders, isLoading: isLoadingProviders } = useQuery<StorageProvider[]>({
    queryKey: ["/api/storage-providers"],
  });

  // Format the size to human-readable format
  const formatSize = (bytes: number | null) => {
    if (bytes === null || bytes === undefined) return "--";
    
    const units = ["B", "KB", "MB", "GB", "TB"];
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
    return sites && Array.isArray(sites) ? sites.find((site: Site) => site.id === siteId) : undefined;
  };

  // Get storage provider by ID
  const getStorageProvider = (providerId: number): StorageProvider | undefined => {
    return storageProviders && Array.isArray(storageProviders) ? storageProviders.find((provider: StorageProvider) => provider.id === providerId) : undefined;
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
      case "completed":
        return (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 border border-green-200 dark:bg-green-950/50 dark:text-green-300 dark:border-green-800">
            <CheckCircle className="w-3 h-3 mr-1.5" />
            <span>Completed</span>
          </div>
        );
      case "failed":
        return (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/50 dark:text-red-300 dark:border-red-800">
            <XCircle className="w-3 h-3 mr-1.5" />
            <span>Failed</span>
          </div>
        );
      case "in_progress":
        return (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800">
            <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
            <span>In Progress</span>
          </div>
        );
      case "pending":
        return (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-50 text-yellow-700 border border-yellow-200 dark:bg-yellow-950/50 dark:text-yellow-300 dark:border-yellow-800">
            <div className="w-2 h-2 mr-1.5 rounded-full bg-yellow-400 dark:bg-yellow-500" />
            <span>Pending</span>
          </div>
        );
      default:
        return (
          <div className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-950/50 dark:text-gray-300 dark:border-gray-800">
            <div className="w-2 h-2 mr-1.5 rounded-full bg-gray-400 dark:bg-gray-500" />
            <span>{status.charAt(0).toUpperCase() + status.slice(1)}</span>
          </div>
        );
    }
  };

  // Filter backups
  const filteredBackups = backups && Array.isArray(backups) ? backups.filter((backup: Backup) => {
    const site = getSite(backup.siteId);
    const provider = backup.storageProviderId ? getStorageProvider(backup.storageProviderId) : null;
    
    // Apply site filter
    if (siteFilter !== "all" && backup.siteId !== parseInt(siteFilter)) {
      return false;
    }
    
    // Apply status filter
    if (statusFilter !== "all" && backup.status !== statusFilter) {
      return false;
    }
    
    // Apply type filter
    if (typeFilter !== "all" && backup.backupType !== typeFilter) {
      return false;
    }
    
    // Apply search term
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const siteMatches = site && (
        site.name.toLowerCase().includes(searchLower) ||
        site.url.toLowerCase().includes(searchLower)
      );
      const providerMatches = provider && provider.name.toLowerCase().includes(searchLower);
      
      return siteMatches || providerMatches;
    }
    
    return true;
  }) : [];
  
  // Sort backups by date (most recent first)
  const sortedBackups = [...(filteredBackups || [])].sort(
    (a, b) => {
      const dateA = a.startedAt ? new Date(a.startedAt).getTime() : 0;
      const dateB = b.startedAt ? new Date(b.startedAt).getTime() : 0;
      return dateB - dateA;
    }
  );

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
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup History</h1>
          <p className="text-muted-foreground">View and manage your site backups</p>
        </div>
        <div className="flex mt-4 md:mt-0 space-x-2">
          <Button variant="outline">
            <FileDown className="mr-1 h-4 w-4" />
            Export Logs
          </Button>
          <Button 
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
              queryClient.refetchQueries({ queryKey: ['/api/backups'] });
              toast({
                title: "Success",
                description: "Backup list refreshed.",
              });
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                {sites && Array.isArray(sites) ? sites.map((site: Site) => (
                  <SelectItem key={site.id} value={site.id.toString()}>
                    {site.name}
                  </SelectItem>
                )) : null}
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

      <Card className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 shadow-sm">
        <CardHeader className="pb-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <CardTitle className="text-gray-900 dark:text-gray-100 flex items-center gap-2">
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
            <div className="text-center py-16">
              <div className="flex flex-col items-center gap-3">
                <FileText className="h-12 w-12 text-gray-400 dark:text-gray-600" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">No backup records found</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 max-w-md">
                  No backup records match your current search criteria. Try adjusting your filters or create a new backup.
                </p>
              </div>
            </div>
          ) : (
            <div className="overflow-hidden bg-white dark:bg-gray-900">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700">
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 h-12 px-6">Site</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 h-12">Type</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 h-12">Status</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 h-12">Size</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 h-12">Files</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 h-12">Storage Provider</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 h-12">Started</TableHead>
                    <TableHead className="font-semibold text-gray-700 dark:text-gray-300 h-12">Completed</TableHead>
                    <TableHead className="text-right font-semibold text-gray-700 dark:text-gray-300 h-12 px-6">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBackups.map((backup: Backup) => {
                    const site = getSite(backup.siteId);
                    const provider = backup.storageProviderId ? getStorageProvider(backup.storageProviderId) : null;
                    
                    return (
                      <TableRow 
                        key={backup.id} 
                        className="group hover:bg-blue-50 dark:hover:bg-gray-800 transition-colors border-b border-gray-100 dark:border-gray-700 h-20 bg-white dark:bg-gray-900"
                      >
                        <TableCell className="px-6 py-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                              {site?.name || "Unknown Site"}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
                              <ExternalLink className="h-3 w-3" />
                              <span className="truncate max-w-48">{site?.url || "--"}</span>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className={`inline-flex items-center px-3 py-1.5 rounded-full text-xs font-semibold transition-all shadow-sm ${
                            backup.backupType === 'files' || backup.backupType === 'file'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-800 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50' 
                              : backup.backupType === 'database' || backup.backupType === 'db'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 dark:border-purple-800 group-hover:bg-purple-100 dark:group-hover:bg-purple-900/50'
                              : 'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50'
                          }`}>
                            {getBackupTypeDisplay(backup.backupType)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="space-y-1">
                            {getStatusBadge(backup.status)}
                            {backup.error && (
                              <div className="text-xs text-red-600 dark:text-red-400 truncate max-w-32" title={backup.error}>
                                {backup.error}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                            {formatSize(backup.filesize || null)}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-semibold text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                            {backup.fileCount ? backup.fileCount.toLocaleString() : "--"}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          <div className="font-medium text-gray-700 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-gray-100 transition-colors">
                            {provider?.name || "Unknown Provider"}
                          </div>
                        </TableCell>
                        <TableCell className="py-4">
                          {backup.startedAt ? (
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                                {format(new Date(backup.startedAt), "MMM d, yyyy")}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {format(new Date(backup.startedAt), "HH:mm:ss")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="py-4">
                          {backup.completedAt ? (
                            <div className="space-y-0.5">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100 group-hover:text-primary transition-colors">
                                {format(new Date(backup.completedAt), "MMM d, yyyy")}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {format(new Date(backup.completedAt), "HH:mm:ss")}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-500 dark:text-gray-400">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right px-6 py-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-9 w-9 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                              >
                                <MoreVertical className="h-4 w-4 text-gray-500 dark:text-gray-400 group-hover:text-primary transition-colors" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-48 shadow-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
                              {backup.status === "completed" && (
                                <DropdownMenuItem onClick={() => handleDownload(backup)} className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                                  <Download className="mr-2 h-4 w-4" />
                                  <span>Download</span>
                                </DropdownMenuItem>
                              )}
                              {backup.status === "failed" && (
                                <DropdownMenuItem
                                  onClick={() => retryMutation.mutate(backup)}
                                  disabled={retryMutation.isPending}
                                  className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100"
                                >
                                  <RefreshCw className={`mr-2 h-4 w-4 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                                  <span>{retryMutation.isPending ? 'Retrying...' : 'Retry'}</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => {
                                setSelectedBackup(backup);
                                setShowDetailsDialog(true);
                              }} className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
                                <Eye className="mr-2 h-4 w-4" />
                                <span>View Details</span>
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem onClick={() => {
                                setSelectedBackup(backup);
                                setShowLogsDialog(true);
                                fetchBackupLogs(backup);
                              }} className="text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-gray-100">
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
                      className={currentPage <= 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                      className={currentPage >= totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"}
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
                <div className="mt-2 p-3 bg-muted rounded-md">
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
              {deleteMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Backup Details Dialog */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
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
                  <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Basic Information</h4>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    <p><strong className="text-gray-900 dark:text-gray-100">ID:</strong> {selectedBackup.id}</p>
                    <p><strong className="text-gray-900 dark:text-gray-100">Type:</strong> {getBackupTypeDisplay(selectedBackup.backupType)}</p>
                    <p><strong className="text-gray-900 dark:text-gray-100">Status:</strong> {selectedBackup.status}</p>
                    {selectedBackup.processId && (
                      <p><strong className="text-gray-900 dark:text-gray-100">Process ID:</strong> {selectedBackup.processId}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">File Details</h4>
                  <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                    {selectedBackup.filename && (
                      <p><strong className="text-gray-900 dark:text-gray-100">Filename:</strong> {selectedBackup.filename}</p>
                    )}
                    <p><strong className="text-gray-900 dark:text-gray-100">Size:</strong> {formatSize(selectedBackup.filesize || null)}</p>
                    {selectedBackup.storagePath && (
                      <p><strong className="text-gray-900 dark:text-gray-100">Storage Path:</strong> {selectedBackup.storagePath}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Timeline</h4>
                <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                  <p><strong className="text-gray-900 dark:text-gray-100">Created:</strong> {format(new Date(selectedBackup.createdAt), "PPpp")}</p>
                  {selectedBackup.startedAt && (
                    <p><strong className="text-gray-900 dark:text-gray-100">Started:</strong> {format(new Date(selectedBackup.startedAt), "PPpp")}</p>
                  )}
                  {selectedBackup.completedAt && (
                    <p><strong className="text-gray-900 dark:text-gray-100">Completed:</strong> {format(new Date(selectedBackup.completedAt), "PPpp")}</p>
                  )}
                </div>
              </div>

              {selectedBackup.metadata && (
                <div>
                  <h4 className="font-semibold mb-2 text-gray-900 dark:text-gray-100">Metadata</h4>
                  <pre className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 p-3 rounded-md overflow-x-auto border border-gray-200 dark:border-gray-700">
                    {JSON.stringify(JSON.parse(selectedBackup.metadata), null, 2)}
                  </pre>
                </div>
              )}

              {selectedBackup.error && (
                <div>
                  <h4 className="font-semibold mb-2 text-red-600 dark:text-red-400">Error Details</h4>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md border border-red-200 dark:border-red-800">
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700">
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
                  <h4 className="font-semibold text-gray-900 dark:text-gray-100">Process Logs ({backupLogs.length} entries)</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedBackup && fetchBackupLogs(selectedBackup)}
                    className="border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
                <div className="bg-gray-900 dark:bg-black text-green-400 p-4 rounded-lg border border-gray-700 font-mono text-sm max-h-96 overflow-y-auto">
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
                                message: log
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
                          console.log(`Processing entry - timestamp: ${timestamp}, entry:`, logEntry);
                          const entry = logEntry as Record<string, any>;
                          return {
                            timestamp,
                            status: entry.status || '',
                            state: entry.state || '',
                            message: entry.message || entry.progress || '',
                            ...entry
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
                        state: 'PARSE_ERROR'
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
                            const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day), parseInt(hour), parseInt(minute), parseInt(second));
                            return {
                              date: dateObj.toLocaleDateString(),
                              time: dateObj.toLocaleTimeString()
                            };
                          }
                          const dateObj = new Date(timestamp);
                          return {
                            date: dateObj.toLocaleDateString(),
                            time: dateObj.toLocaleTimeString()
                          };
                        } catch (e) {
                          return {
                            date: '',
                            time: timestamp
                          };
                        }
                      };

                      const { date, time } = formatTimestamp(logEntry.timestamp);
                      const message = logEntry.message || 'No message';
                      const status = logEntry.status || '';
                      const state = logEntry.state || '';

                      return (
                        <div key={index} className="mb-2 flex flex-wrap">
                          <span className="text-cyan-400 mr-3 whitespace-nowrap">
                            [{date} {time}]
                          </span>
                          {status && (
                            <span className="text-yellow-400 mr-2 font-semibold">
                              [{status}]
                            </span>
                          )}
                          {state && (
                            <span className="text-blue-400 mr-2">
                              {state}:
                            </span>
                          )}
                          <span className="text-green-400 flex-1">
                            {message}
                          </span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                No logs available for this backup
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BackupHistory;
