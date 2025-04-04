import { useQuery } from "@tanstack/react-query";
import { Backup, Site, StorageProvider } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Cloud, 
  Download, 
  MoreVertical, 
  RefreshCw 
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistanceToNow } from "date-fns";

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

  // Get status badge color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-100 text-green-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "in_progress":
        return "bg-blue-100 text-blue-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get site initial for avatar
  const getSiteInitial = (name: string) => {
    return name ? name.charAt(0).toUpperCase() : "?";
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Recent Backup Activity</CardTitle>
        <Button 
          variant="ghost" 
          className="text-primary hover:text-primary-dark font-medium"
          onClick={() => refetch()}
        >
          View All
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin text-primary" />
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-neutral-300">
              <thead className="bg-neutral-200">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Site</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Size</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Destination</th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-neutral-700 uppercase tracking-wider">Timestamp</th>
                  <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-neutral-700 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-neutral-300">
                {joinedBackups.slice(0, limit).map((backup) => (
                  <tr key={backup.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8 rounded-full bg-primary-light flex items-center justify-center text-white">
                          <span>{getSiteInitial(backup.site?.name || "")}</span>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-neutral-900">{backup.site?.name || "Unknown Site"}</div>
                          <div className="text-sm text-neutral-600">{backup.site?.url || ""}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(backup.status)}`}>
                        {backup.status.charAt(0).toUpperCase() + backup.status.slice(1)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-700">
                      {formatSize(backup.size)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-700">
                      <div className="flex items-center">
                        <Cloud className="mr-1 h-4 w-4" />
                        {backup.storageProvider?.name || "Unknown"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-700">
                      {backup.startedAt ? (
                        <>
                          {format(new Date(backup.startedAt), "MMM d, HH:mm")}
                          <div className="text-xs text-neutral-500">
                            {formatDistanceToNow(new Date(backup.startedAt), { addSuffix: true })}
                          </div>
                        </>
                      ) : "--"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      {backup.status === "completed" ? (
                        <Button variant="ghost" className="text-primary hover:text-primary-dark mr-3">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      ) : backup.status === "failed" ? (
                        <Button variant="ghost" className="text-primary hover:text-primary-dark mr-3">
                          <RefreshCw className="h-4 w-4 mr-1" />
                          Retry
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="text-neutral-600 hover:text-neutral-900">
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {backup.status === "completed" && (
                            <DropdownMenuItem>
                              <Download className="h-4 w-4 mr-2" />
                              Download
                            </DropdownMenuItem>
                          )}
                          {backup.status === "failed" && (
                            <DropdownMenuItem>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              Retry
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-red-600">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default RecentBackups;
