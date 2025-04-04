import { useQuery } from "@tanstack/react-query";
import { DashboardStats, Backup, Site, StorageProvider } from "@/lib/types";
import StatsCard from "@/components/dashboard/stats-card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AddSiteForm from "@/components/sites/add-site-form";
import { useState } from "react";
import { 
  Plus, 
  Loader2, 
  Server, 
  HardDrive, 
  CheckCircle, 
  AlertCircle,
  Download, 
  MoreHorizontal,
  Clock
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const Dashboard = () => {
  const [isAddingSite, setIsAddingSite] = useState(false);
  
  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  // Fetch recent backups
  const { data: backups, isLoading: isLoadingBackups } = useQuery({
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

  // Format the size to human-readable format
  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    
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
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            Completed
          </span>
        );
      case "failed":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            Failed
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </span>
        );
    }
  };

  // Join backups with site and storage provider data
  const joinedBackups = backups && sites && storageProviders && Array.isArray(backups) && Array.isArray(sites) && Array.isArray(storageProviders)
    ? backups.map((backup: Backup) => ({
        ...backup,
        site: sites.find((site: Site) => site.id === backup.siteId),
        storageProvider: storageProviders.find(
          (provider: StorageProvider) => provider.id === backup.storageProviderId
        ),
      }))
    : [];

  return (
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-medium text-gray-800">Backup Overview</h3>
          <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
            <DialogTrigger asChild>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
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
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-red-500">
            Failed to load dashboard statistics
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatsCard
              title="Total Sites"
              value={stats?.totalSites || 0}
              icon={Server}
              changeText="+2 since last month"
              changeColor="text-green-600"
            />
            
            <StatsCard
              title="Storage Used"
              value={formatSize(stats?.totalStorage || 0)}
              icon={HardDrive}
              changeText="+215 GB since last week"
              changeColor="text-yellow-600"
            />
            
            <StatsCard
              title="Backups Completed"
              value={stats?.completedBackups || 0}
              icon={CheckCircle}
              changeText={`${stats ? Math.round((stats.completedBackups / (stats.completedBackups + stats.failedBackups || 1)) * 100) : 0}% success rate`}
              changeColor="text-green-600"
            />
            
            <StatsCard
              title="Failed Backups"
              value={stats?.failedBackups || 0}
              icon={AlertCircle}
              iconColor="text-red-500"
              changeText="Action required"
              changeColor="text-red-500"
            />
          </div>
        )}
      </div>
      
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-medium text-gray-800">Recent Backup Activity</h3>
          <Button variant="ghost" className="text-blue-600 hover:text-blue-700">
            View All
          </Button>
        </div>
        
        {isLoadingBackups ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : joinedBackups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No recent backups found
          </div>
        ) : (
          <div className="overflow-x-auto bg-white border border-gray-200 rounded-md shadow-sm">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Site
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Size
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Destination
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {joinedBackups.slice(0, 3).map((backup: any) => (
                  <tr key={backup.id}>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {backup.site?.name || "Unknown Site"}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(backup.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {backup.size ? formatSize(backup.size) : '--'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <span className="text-gray-500">{backup.storageProvider?.name || "Unknown"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {backup.startedAt ? (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-1 text-gray-400" />
                          <div>
                            <div>Apr {new Date(backup.startedAt).getDate()}, {new Date(backup.startedAt).getFullYear().toString().substring(2)}</div>
                            <div className="text-xs">less than a minute ago</div>
                          </div>
                        </div>
                      ) : "--"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {backup.status === "completed" ? (
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                          <Download className="h-4 w-4 mr-1" />
                          Download
                        </Button>
                      ) : backup.status === "failed" ? (
                        <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700">
                          Retry
                        </Button>
                      ) : null}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="ml-1">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>View Details</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
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

export default Dashboard;
