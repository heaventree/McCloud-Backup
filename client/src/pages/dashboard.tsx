import { useQuery } from "@tanstack/react-query";
import { DashboardStats } from "@/lib/types";
import StatsCard from "@/components/dashboard/stats-card";
import RecentBackups from "@/components/dashboard/recent-backups";
import StorageOverview from "@/components/dashboard/storage-overview";
import UpcomingBackups from "@/components/dashboard/upcoming-backups";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import AddSiteForm from "@/components/sites/add-site-form";
import { useState } from "react";
import { Plus, Loader2, Computer, HardDrive, Archive, AlertCircle } from "lucide-react";

const Dashboard = () => {
  const [isAddingSite, setIsAddingSite] = useState(false);
  
  const { data: stats, isLoading, isError } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
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

  return (
    <div>
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-medium text-neutral-800">Backup Overview</h3>
          <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary-dark text-white">
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
              icon={Computer}
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
              icon={Archive}
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
        <RecentBackups limit={5} />
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <StorageOverview />
        <UpcomingBackups />
      </div>
    </div>
  );
};

export default Dashboard;
