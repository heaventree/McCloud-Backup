import { useQuery } from "@tanstack/react-query";
import { Backup, Site, StorageProvider } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { 
  Clock,
  Download, 
  ArrowRight,
  Share2,
  FileUp,
  Sliders,
  Loader2
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from "date-fns";
import { SvglIcon } from "@/components/ui/svgl-icon";

interface RecentBackupsProps {
  limit?: number;
}

interface JoinedBackup extends Backup {
  site: Site;
  storageProvider: StorageProvider;
}

const RecentBackups = ({ limit = 5 }: RecentBackupsProps) => {
  // Fetch recent backups
  const { data: backups, isLoading, isError, refetch } = useQuery({
    queryKey: ["/api/backups/recent"], 
  });

  // Fetch sites for enriching backup data
  const { data: sites } = useQuery({
    queryKey: ["/api/sites"],
  });

  // Fetch storage providers for enriching backup data
  const { data: storageProviders } = useQuery({
    queryKey: ["/api/storage-providers"],
  });

  // Join backups with site and storage provider data
  const joinedBackups: JoinedBackup[] = backups && sites && storageProviders && Array.isArray(backups) && Array.isArray(sites) && Array.isArray(storageProviders)
    ? backups.map((backup: Backup) => ({
        ...backup,
        site: sites.find((site: Site) => site.id === backup.siteId),
        storageProvider: storageProviders.find(
          (provider: StorageProvider) => provider.id === backup.storageProviderId
        ),
      }))
    : [];

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

  // Get status badge
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <span className="badge badge-success">Completed</span>;
      case "failed":
        return <span className="badge badge-danger">Failed</span>;
      case "in_progress":
        return <span className="badge badge-info">In Progress</span>;
      default:
        return <span className="badge">{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
    }
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between p-5 border-b border-gray-100">
        <h5 className="card-title m-0">Recent Backup Activity</h5>
        <Button 
          variant="ghost" 
          size="sm" 
          className="text-blue-600 hover:text-blue-700 flex items-center"
          onClick={() => refetch()}
        >
          View All
          <ArrowRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
      
      <div className="card-body p-0">
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-red-500">
            Failed to load recent backups
          </div>
        ) : joinedBackups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recent backups found
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Status</th>
                  <th>Size</th>
                  <th>Destination</th>
                  <th>Timestamp</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {joinedBackups.slice(0, limit).map((backup) => (
                  <tr key={backup.id}>
                    <td>
                      <div className="flex items-center">
                        <div className="h-8 w-8 rounded bg-blue-50 text-blue-600 flex items-center justify-center mr-3">
                          <Share2 className="h-4 w-4" />
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{backup.site?.name || "Unknown Site"}</div>
                          <div className="text-xs text-gray-500">{backup.site?.url || "Unknown URL"}</div>
                        </div>
                      </div>
                    </td>
                    <td>{getStatusBadge(backup.status)}</td>
                    <td>{formatSize(backup.size)}</td>
                    <td>
                      <div className="flex items-center">
                        <div className="h-6 w-6 rounded bg-gray-100 text-gray-500 flex items-center justify-center mr-2">
                          {backup.storageProvider ? (
                            <SvglIcon providerType={backup.storageProvider?.type} width={14} height={14} />
                          ) : (
                            <FileUp className="h-3 w-3" />
                          )}
                        </div>
                        <span>{backup.storageProvider?.name || "Unknown"}</span>
                      </div>
                    </td>
                    <td>
                      {backup.startedAt ? (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                          <div>
                            <div>{format(new Date(backup.startedAt), "MMM d, yy")}</div>
                            <div className="text-xs text-gray-500">{formatDistanceToNow(new Date(backup.startedAt), { addSuffix: true })}</div>
                          </div>
                        </div>
                      ) : "--"}
                    </td>
                    <td className="text-right">
                      <div className="flex items-center justify-end space-x-1">
                        {backup.status === "completed" ? (
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                            <Download className="h-4 w-4" />
                          </Button>
                        ) : backup.status === "failed" ? (
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                            Retry
                          </Button>
                        ) : null}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-gray-500">
                              <Sliders className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-[160px]">
                            <DropdownMenuItem>View Details</DropdownMenuItem>
                            <DropdownMenuItem>Download Logs</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
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
  );
};

export default RecentBackups;
