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
      return apiRequest(`/api/backups/${backupId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/backups'] });
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
      return apiRequest(`/api/backups/${backup.id}/retry`, 'POST');
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
      const site = getSite(backup.siteId);
      if (!site) {
        throw new Error("Site not found");
      }

      const response = await fetch(`${site.url}/index.php?rest_route=%2Fbacksheep%2Fv1%2Fbackup%2Fstatus%2Flog&process_id=${backup.processId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${site.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      if (data.status === 'SUCCESS' && data.logs) {
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
          <div className="flex items-center">
            <CheckCircle className="w-4 h-4 mr-1 text-green-500" />
            <span className="text-green-600 font-medium">Completed</span>
          </div>
        );
      case "failed":
        return (
          <div className="flex items-center">
            <XCircle className="w-4 h-4 mr-1 text-red-500" />
            <span className="text-red-600 font-medium">Failed</span>
          </div>
        );
      case "in_progress":
        return (
          <div className="flex items-center">
            <Loader2 className="w-4 h-4 mr-1 text-blue-500 animate-spin" />
            <span className="text-blue-600 font-medium">In Progress</span>
          </div>
        );
      case "pending":
        return (
          <div className="flex items-center">
            <div className="w-2 h-2 mr-2 rounded-full bg-yellow-400" />
            <span className="text-yellow-600 font-medium">Pending</span>
          </div>
        );
      default:
        return (
          <div className="flex items-center">
            <div className="w-2 h-2 mr-2 rounded-full bg-gray-400" />
            <span className="text-gray-600">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
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
    (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
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
          <Button>
            <RefreshCw className="mr-1 h-4 w-4" />
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle>Backup Results</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : paginatedBackups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No backup records found matching your criteria
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-muted/20">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/10 hover:bg-muted/10">
                    <TableHead className="font-semibold">Site</TableHead>
                    <TableHead className="font-semibold">Type</TableHead>
                    <TableHead className="font-semibold">Status</TableHead>
                    <TableHead className="font-semibold">Size</TableHead>
                    <TableHead className="font-semibold">Files</TableHead>
                    <TableHead className="font-semibold">Storage Provider</TableHead>
                    <TableHead className="font-semibold">Started</TableHead>
                    <TableHead className="font-semibold">Completed</TableHead>
                    <TableHead className="text-right font-semibold">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedBackups.map((backup: Backup) => {
                    const site = getSite(backup.siteId);
                    const provider = backup.storageProviderId ? getStorageProvider(backup.storageProviderId) : null;
                    
                    return (
                      <TableRow key={backup.id} className="group hover:bg-gradient-to-r hover:from-muted/20 hover:to-muted/10 hover:shadow-md hover:scale-[1.002] transition-all duration-200 ease-in-out border-b border-muted/20 cursor-pointer">
                        <TableCell className="group-hover:bg-transparent">
                          <div>
                            <div className="font-medium group-hover:text-foreground transition-colors">{site?.name || "Unknown Site"}</div>
                            <div className="text-sm text-muted-foreground flex items-center group-hover:text-muted-foreground/80 transition-colors">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {site?.url || "--"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="group-hover:bg-transparent">
                          <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium transition-all group-hover:shadow-sm ${
                            backup.backupType === 'files' || backup.backupType === 'file'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 group-hover:bg-blue-200 dark:group-hover:bg-blue-800' 
                              : backup.backupType === 'database' || backup.backupType === 'db'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 group-hover:bg-purple-200 dark:group-hover:bg-purple-800'
                              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 group-hover:bg-green-200 dark:group-hover:bg-green-800'
                          }`}>
                            {getBackupTypeDisplay(backup.backupType)}
                          </div>
                        </TableCell>
                        <TableCell className="group-hover:bg-transparent">
                          {getStatusBadge(backup.status)}
                          {backup.error && (
                            <div className="text-xs text-red-500 mt-1 group-hover:text-red-600 transition-colors">{backup.error}</div>
                          )}
                        </TableCell>
                        <TableCell className="group-hover:bg-transparent">
                          <span className="font-medium group-hover:text-foreground transition-colors">{formatSize(backup.filesize || null)}</span>
                        </TableCell>
                        <TableCell className="group-hover:bg-transparent">
                          {backup.fileCount ? (
                            <div>
                              <span className="font-medium group-hover:text-foreground transition-colors">{backup.fileCount.toLocaleString()}</span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="group-hover:bg-transparent">
                          <span className="group-hover:text-foreground transition-colors">{provider?.name || "Unknown Provider"}</span>
                        </TableCell>
                        <TableCell className="group-hover:bg-transparent">
                          <div className="whitespace-nowrap group-hover:text-foreground transition-colors">
                            {format(new Date(backup.startedAt), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
                            {format(new Date(backup.startedAt), "HH:mm:ss")}
                          </div>
                        </TableCell>
                        <TableCell className="group-hover:bg-transparent">
                          {backup.completedAt ? (
                            <>
                              <div className="whitespace-nowrap group-hover:text-foreground transition-colors">
                                {format(new Date(backup.completedAt), "MMM d, yyyy")}
                              </div>
                              <div className="text-xs text-muted-foreground group-hover:text-muted-foreground/80 transition-colors">
                                {format(new Date(backup.completedAt), "HH:mm:ss")}
                              </div>
                            </>
                          ) : (
                            <span className="text-muted-foreground">--</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right group-hover:bg-transparent">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {backup.status === "completed" && (
                                <>
                                  <DropdownMenuItem onClick={() => handleDownload(backup)}>
                                    <Download className="mr-2 h-4 w-4" />
                                    <span>Download</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    <span>Restore Site</span>
                                  </DropdownMenuItem>
                                </>
                              )}
                              {backup.status === "failed" && (
                                <DropdownMenuItem
                                  onClick={() => retryMutation.mutate(backup)}
                                  disabled={retryMutation.isPending}
                                >
                                  <RefreshCw className={`mr-2 h-4 w-4 ${retryMutation.isPending ? 'animate-spin' : ''}`} />
                                  <span>{retryMutation.isPending ? 'Retrying...' : 'Retry'}</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={() => {
                                setSelectedBackup(backup);
                                setShowDetailsDialog(true);
                              }}>
                                <Eye className="mr-2 h-4 w-4" />
                                <span>View Details</span>
                              </DropdownMenuItem>
                              
                              <DropdownMenuItem onClick={() => {
                                setSelectedBackup(backup);
                                setShowLogsDialog(true);
                                fetchBackupLogs(backup);
                              }}>
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
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Backup Details</DialogTitle>
            <DialogDescription>
              Detailed information about this backup
            </DialogDescription>
          </DialogHeader>
          {selectedBackup && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">Basic Information</h4>
                  <div className="space-y-2 text-sm">
                    <p><strong>ID:</strong> {selectedBackup.id}</p>
                    <p><strong>Type:</strong> {getBackupTypeDisplay(selectedBackup.backupType)}</p>
                    <p><strong>Status:</strong> {selectedBackup.status}</p>
                    {selectedBackup.processId && (
                      <p><strong>Process ID:</strong> {selectedBackup.processId}</p>
                    )}
                  </div>
                </div>
                <div>
                  <h4 className="font-semibold mb-2">File Details</h4>
                  <div className="space-y-2 text-sm">
                    {selectedBackup.filename && (
                      <p><strong>Filename:</strong> {selectedBackup.filename}</p>
                    )}
                    <p><strong>Size:</strong> {formatSize(selectedBackup.filesize || null)}</p>
                    {selectedBackup.storagePath && (
                      <p><strong>Storage Path:</strong> {selectedBackup.storagePath}</p>
                    )}
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold mb-2">Timeline</h4>
                <div className="space-y-2 text-sm">
                  <p><strong>Created:</strong> {format(new Date(selectedBackup.createdAt), "PPpp")}</p>
                  {selectedBackup.startedAt && (
                    <p><strong>Started:</strong> {format(new Date(selectedBackup.startedAt), "PPpp")}</p>
                  )}
                  {selectedBackup.completedAt && (
                    <p><strong>Completed:</strong> {format(new Date(selectedBackup.completedAt), "PPpp")}</p>
                  )}
                </div>
              </div>

              {selectedBackup.metadata && (
                <div>
                  <h4 className="font-semibold mb-2">Metadata</h4>
                  <pre className="text-xs bg-muted p-3 rounded-md overflow-x-auto">
                    {JSON.stringify(JSON.parse(selectedBackup.metadata), null, 2)}
                  </pre>
                </div>
              )}

              {selectedBackup.error && (
                <div>
                  <h4 className="font-semibold mb-2 text-red-600">Error Details</h4>
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
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
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Backup Logs</DialogTitle>
            <DialogDescription>
              Process logs for this backup operation
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {logsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Loading logs...</span>
              </div>
            ) : backupLogs.length > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Process Logs ({backupLogs.length} entries)</h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => selectedBackup && fetchBackupLogs(selectedBackup)}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
                <div className="bg-black text-green-400 p-4 rounded-md font-mono text-sm max-h-96 overflow-y-auto">
                  {backupLogs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {typeof log === 'string' ? log : JSON.stringify(log)}
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
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
