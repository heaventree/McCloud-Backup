import { useQuery } from "@tanstack/react-query";
import { BackupSchedule } from "@/lib/types";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Loader2 } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

const UpcomingBackups = () => {
  const { data: upcomingBackups, isLoading, isError } = useQuery({
    queryKey: ["/api/dashboard/upcoming-backups"],
  });

  // Determine border color based on time until next backup
  const getBorderColor = (nextRun: string) => {
    const now = new Date();
    const scheduledTime = new Date(nextRun);
    const hoursUntil = (scheduledTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (hoursUntil < 6) {
      return "border-primary-light";
    } else if (hoursUntil < 12) {
      return "border-secondary-light";
    } else {
      return "border-neutral-400";
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Upcoming Backups</CardTitle>
        <Button
          variant="ghost"
          className="text-primary hover:text-primary-dark text-sm font-medium"
        >
          View Schedule
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <div className="text-center py-8 text-red-500">
            Failed to load upcoming backups
          </div>
        ) : upcomingBackups && upcomingBackups.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No upcoming backups scheduled
          </div>
        ) : (
          <div className="space-y-4">
            {upcomingBackups && upcomingBackups.map((backup: BackupSchedule) => (
              <div 
                key={backup.id} 
                className={`border-l-4 ${getBorderColor(backup.nextRun!)} pl-4 py-2`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-neutral-800">{backup.site?.name}</p>
                    <p className="text-sm text-neutral-600">{backup.site?.url}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-medium text-neutral-800">
                      {backup.nextRun ? format(new Date(backup.nextRun), "MMM d, HH:mm") : "--"}
                    </p>
                    <p className="text-xs text-neutral-600">
                      {backup.nextRun ? 
                        `in ${formatDistanceToNow(new Date(backup.nextRun))}` : 
                        "--"
                      }
                    </p>
                  </div>
                </div>
              </div>
            ))}
            
            <div className="mt-2 pt-4 border-t border-neutral-300">
              <Button variant="ghost" className="w-full text-neutral-700 hover:text-neutral-900">
                <Clock className="mr-1 h-4 w-4" />
                <span>Reschedule Backups</span>
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default UpcomingBackups;
