import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Site, Backup, StorageProvider } from "@/lib/types";
import { Search, Download, RefreshCw, MoreVertical, FileDown, Trash, Filter, Loader2, ExternalLink, XCircle, CheckCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const BackupHistory = () => {
  const [siteFilter, setSiteFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  
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
    const provider = getStorageProvider(backup.storageProviderId);
    
    // Apply site filter
    if (siteFilter !== "all" && backup.siteId !== parseInt(siteFilter)) {
      return false;
    }
    
    // Apply status filter
    if (statusFilter !== "all" && backup.status !== statusFilter) {
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
              onValueChange={setSiteFilter}
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
              value={statusFilter}
              onValueChange={setStatusFilter}
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
          ) : sortedBackups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No backup records found matching your criteria
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Site</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Size</TableHead>
                    <TableHead>Storage Provider</TableHead>
                    <TableHead>Started</TableHead>
                    <TableHead>Completed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedBackups.map((backup: Backup) => {
                    const site = getSite(backup.siteId);
                    const provider = getStorageProvider(backup.storageProviderId);
                    
                    return (
                      <TableRow key={backup.id}>
                        <TableCell>
                          <div>
                            <div className="font-medium">{site?.name || "Unknown Site"}</div>
                            <div className="text-sm text-muted-foreground flex items-center">
                              <ExternalLink className="h-3 w-3 mr-1" />
                              {site?.url || "--"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(backup.status)}
                          {backup.error && (
                            <div className="text-xs text-red-500 mt-1">{backup.error}</div>
                          )}
                        </TableCell>
                        <TableCell>{formatSize(backup.size)}</TableCell>
                        <TableCell>{provider?.name || "Unknown Provider"}</TableCell>
                        <TableCell>
                          <div className="whitespace-nowrap">
                            {format(new Date(backup.startedAt), "MMM d, yyyy")}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {format(new Date(backup.startedAt), "HH:mm:ss")}
                          </div>
                        </TableCell>
                        <TableCell>
                          {backup.completedAt ? (
                            <>
                              <div className="whitespace-nowrap">
                                {format(new Date(backup.completedAt), "MMM d, yyyy")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(backup.completedAt), "HH:mm:ss")}
                              </div>
                            </>
                          ) : (
                            "--"
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {backup.status === "completed" && (
                                <DropdownMenuItem>
                                  <Download className="mr-2 h-4 w-4" />
                                  <span>Download</span>
                                </DropdownMenuItem>
                              )}
                              {backup.status === "failed" && (
                                <DropdownMenuItem>
                                  <RefreshCw className="mr-2 h-4 w-4" />
                                  <span>Retry</span>
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem>
                                <ExternalLink className="mr-2 h-4 w-4" />
                                <span>View Details</span>
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem className="text-red-600">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default BackupHistory;
