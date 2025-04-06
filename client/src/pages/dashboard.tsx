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
  Clock,
  ArrowRight,
  Share2,
  FileUp,
  Sliders
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
        return <span className="badge badge-success">Completed</span>;
      case "failed":
        return <span className="badge badge-danger">Failed</span>;
      case "in_progress":
        return <span className="badge badge-info">In Progress</span>;
      default:
        return <span className="badge">{status.charAt(0).toUpperCase() + status.slice(1)}</span>;
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
    <div>
      {/* Page header */}
      <div className="flex justify-between items-center mb-6 py-3 h-16">
        <div className="flex flex-col justify-center">
          <h4 className="text-2xl font-semibold text-gray-800 dark:text-gray-100 leading-none">Dashboard</h4>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Welcome to McCloud Backup dashboard</p>
        </div>
        <div className="flex space-x-3 items-center">
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
              <AddSiteForm onSuccess={() => setIsAddingSite(false)} />
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
          <div className="text-center py-8 text-red-500">
            Failed to load dashboard statistics
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
              changeText="+215 GB since last week"
              changeColor="text-yellow-600"
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
          <div className="flex items-center justify-between p-5 border-b border-gray-100 dark:border-gray-700">
            <h5 className="card-title m-0 dark:text-gray-100">Recent Backup Activity</h5>
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 flex items-center">
              View All
              <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
          
          <div className="card-body p-0">
            {isLoadingBackups ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : joinedBackups.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
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
                            <div className="h-8 w-8 rounded bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mr-3">
                              <Share2 className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="font-medium text-gray-800 dark:text-gray-200">{backup.site?.name || "Unknown Site"}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">{backup.site?.url || "Unknown URL"}</div>
                            </div>
                          </div>
                        </td>
                        <td>{getStatusBadge(backup.status)}</td>
                        <td>{backup.size ? formatSize(backup.size) : '--'}</td>
                        <td>
                          <div className="flex items-center">
                            <div className="h-6 w-6 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 flex items-center justify-center mr-2">
                              <FileUp className="h-3 w-3" />
                            </div>
                            <span className="dark:text-gray-300">{backup.storageProvider?.name || "Unknown"}</span>
                          </div>
                        </td>
                        <td>
                          {backup.startedAt ? (
                            <div className="flex items-center">
                              <Clock className="h-4 w-4 mr-1.5 text-gray-400" />
                              <div>
                                <div className="dark:text-gray-300">{format(new Date(backup.startedAt), "MMM d, yy")}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{formatDistanceToNow(new Date(backup.startedAt), { addSuffix: true })}</div>
                              </div>
                            </div>
                          ) : "--"}
                        </td>
                        <td className="text-right">
                          <div className="flex items-center justify-end space-x-1">
                            {backup.status === "completed" ? (
                              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                                <Download className="h-4 w-4" />
                              </Button>
                            ) : backup.status === "failed" ? (
                              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                                Retry
                              </Button>
                            ) : null}
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm" className="text-gray-500 dark:text-gray-400">
                                  <Sliders className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-[160px]">
                                <DropdownMenuItem>View Details</DropdownMenuItem>
                                <DropdownMenuItem>Download Logs</DropdownMenuItem>
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
    </div>
  );
};

export default Dashboard;
