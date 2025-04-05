import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BackupSchedule, Site } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { format, formatDistanceToNow } from "date-fns";
import { Clock, CalendarClock, Plus, Loader2, Power, Settings } from "lucide-react";

const BackupSchedulePage = () => {
  const { toast } = useToast();
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);

  const { data: schedules, isLoading, isError } = useQuery({
    queryKey: ["/api/backup-schedules"],
  });

  const { data: sites } = useQuery({
    queryKey: ["/api/sites"],
  });

  // Define form schema for adding/editing backup schedule
  const scheduleFormSchema = z.object({
    siteId: z.preprocess(
      (val) => parseInt(String(val), 10),
      z.number().positive("Site selection is required")
    ),
    frequency: z.enum(["hourly", "daily", "weekly", "monthly"]),
    dayOfWeek: z.preprocess(
      (val) => val === "" ? null : parseInt(String(val), 10),
      z.number().min(0).max(6).nullable()
    ),
    hourOfDay: z.preprocess(
      (val) => parseInt(String(val), 10),
      z.number().min(0).max(23)
    ),
    minuteOfHour: z.preprocess(
      (val) => parseInt(String(val), 10),
      z.number().min(0).max(59)
    ),
    backupType: z.enum(["full", "incremental"]).default("full"),
    fullBackupFrequency: z.preprocess(
      (val) => val === "" ? null : parseInt(String(val), 10),
      z.number().min(1).max(30).nullable()
    ),
    retentionCount: z.preprocess(
      (val) => val === "" ? null : parseInt(String(val), 10),
      z.number().min(1).nullable()
    ),
    enabled: z.boolean().default(true),
  });

  type ScheduleFormValues = z.infer<typeof scheduleFormSchema>;

  const form = useForm<ScheduleFormValues>({
    resolver: zodResolver(scheduleFormSchema),
    defaultValues: {
      siteId: undefined,
      frequency: "daily",
      dayOfWeek: null,
      hourOfDay: 0,
      minuteOfHour: 0,
      backupType: "full",
      fullBackupFrequency: null,
      retentionCount: null,
      enabled: true,
    },
  });

  const createScheduleMutation = useMutation({
    mutationFn: async (data: ScheduleFormValues) => {
      const response = await apiRequest("POST", "/api/backup-schedules", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backup-schedules"] });
      toast({
        title: "Schedule created",
        description: "Backup schedule has been created successfully",
      });
      setIsAddingSchedule(false);
      form.reset();
    },
    onError: (error) => {
      toast({
        title: "Error creating schedule",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const toggleScheduleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: number; enabled: boolean }) => {
      const response = await apiRequest("PUT", `/api/backup-schedules/${id}`, { enabled });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backup-schedules"] });
      toast({
        title: "Schedule updated",
        description: "Backup schedule status has been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error updating schedule",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ScheduleFormValues) => {
    createScheduleMutation.mutate(data);
  };

  // Get site name by ID
  const getSiteName = (siteId: number) => {
    if (!sites) return "Unknown Site";
    const site = sites.find((site: Site) => site.id === siteId);
    return site ? site.name : "Unknown Site";
  };

  // Format schedule frequency for display
  const formatSchedule = (schedule: BackupSchedule) => {
    let schedule_text = "";
    
    switch(schedule.frequency) {
      case "hourly":
        schedule_text = `Every hour at ${schedule.minuteOfHour} minutes past the hour`;
        break;
      case "daily":
        schedule_text = `Daily at ${String(schedule.hourOfDay).padStart(2, '0')}:${String(schedule.minuteOfHour).padStart(2, '0')}`;
        break;
      case "weekly":
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const day = schedule.dayOfWeek !== null ? days[schedule.dayOfWeek] : "Sunday";
        schedule_text = `Every ${day} at ${String(schedule.hourOfDay).padStart(2, '0')}:${String(schedule.minuteOfHour).padStart(2, '0')}`;
        break;
      case "monthly":
        schedule_text = `Monthly on day 1 at ${String(schedule.hourOfDay).padStart(2, '0')}:${String(schedule.minuteOfHour).padStart(2, '0')}`;
        break;
      default:
        schedule_text = "Custom schedule";
    }
    
    return schedule_text;
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Backup Schedule</h1>
          <p className="text-muted-foreground">Manage automated backup schedules for your sites</p>
        </div>
        <Dialog open={isAddingSchedule} onOpenChange={setIsAddingSchedule}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0">
              <Plus className="mr-1 h-4 w-4" />
              Add Schedule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Backup Schedule</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="siteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Site</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value?.toString()}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a site" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {sites && sites.map((site: Site) => (
                            <SelectItem key={site.id} value={site.id.toString()}>
                              {site.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="frequency"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Frequency</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select frequency" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="hourly">Hourly</SelectItem>
                          <SelectItem value="daily">Daily</SelectItem>
                          <SelectItem value="weekly">Weekly</SelectItem>
                          <SelectItem value="monthly">Monthly</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch('frequency') === 'weekly' && (
                  <FormField
                    control={form.control}
                    name="dayOfWeek"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Day of Week</FormLabel>
                        <Select 
                          onValueChange={field.onChange} 
                          defaultValue={field.value?.toString() || "0"}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select day" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="0">Sunday</SelectItem>
                            <SelectItem value="1">Monday</SelectItem>
                            <SelectItem value="2">Tuesday</SelectItem>
                            <SelectItem value="3">Wednesday</SelectItem>
                            <SelectItem value="4">Thursday</SelectItem>
                            <SelectItem value="5">Friday</SelectItem>
                            <SelectItem value="6">Saturday</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {form.watch('frequency') !== 'hourly' && (
                  <FormField
                    control={form.control}
                    name="hourOfDay"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Hour (0-23)</FormLabel>
                        <FormControl>
                          <Input type="number" min="0" max="23" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                <FormField
                  control={form.control}
                  name="minuteOfHour"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Minute (0-59)</FormLabel>
                      <FormControl>
                        <Input type="number" min="0" max="59" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="backupType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Backup Type</FormLabel>
                      <Select 
                        onValueChange={field.onChange} 
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select backup type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="full">Full</SelectItem>
                          <SelectItem value="incremental">Incremental</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                {form.watch('backupType') === 'incremental' && (
                  <FormField
                    control={form.control}
                    name="fullBackupFrequency"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Full Backup Every (# of incremental backups)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min="1" 
                            max="30" 
                            placeholder="Eg. 7 (weekly full backup)" 
                            value={field.value === null ? '' : field.value}
                            onChange={(e) => {
                              if (e.target.value === '') {
                                field.onChange(null);
                              } else {
                                field.onChange(parseInt(e.target.value));
                              }
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                
                <FormField
                  control={form.control}
                  name="retentionCount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Number of Backups to Keep</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          min="1" 
                          placeholder="Leave empty for unlimited" 
                          value={field.value === null ? '' : field.value}
                          onChange={(e) => {
                            if (e.target.value === '') {
                              field.onChange(null);
                            } else {
                              field.onChange(parseInt(e.target.value));
                            }
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="enabled"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Enabled</FormLabel>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createScheduleMutation.isPending}
                >
                  {createScheduleMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating Schedule...
                    </>
                  ) : (
                    "Create Schedule"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : isError ? (
        <div className="text-center py-12 text-red-500">
          Failed to load backup schedules
        </div>
      ) : schedules && schedules.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No backup schedules configured
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {schedules && schedules.map((schedule: BackupSchedule) => (
            <Card key={schedule.id}>
              <CardHeader className="pb-2">
                <div className="flex justify-between items-start">
                  <CardTitle className="text-lg">{getSiteName(schedule.siteId)}</CardTitle>
                  <div className="flex space-x-2">
                    <Switch
                      checked={schedule.enabled}
                      onCheckedChange={(enabled) => 
                        toggleScheduleMutation.mutate({ id: schedule.id, enabled })
                      }
                      disabled={toggleScheduleMutation.isPending}
                    />
                    <Button variant="ghost" size="icon">
                      <Settings className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-start space-x-2">
                  <CalendarClock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Schedule</p>
                    <p className="text-sm text-muted-foreground">{formatSchedule(schedule)}</p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium">Next Run</p>
                    <p className="text-sm text-muted-foreground">
                      {schedule.nextRun ? (
                        <>
                          {format(new Date(schedule.nextRun), "MMM d, yyyy HH:mm")}
                          <span className="ml-1 text-xs">
                            ({formatDistanceToNow(new Date(schedule.nextRun), { addSuffix: true })})
                          </span>
                        </>
                      ) : "Not scheduled"}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-start space-x-2">
                  <Power className={`h-5 w-5 mt-0.5 ${schedule.enabled ? 'text-green-500' : 'text-gray-400'}`} />
                  <div>
                    <p className="font-medium">Status</p>
                    <p className="text-sm text-muted-foreground">
                      {schedule.enabled ? "Enabled" : "Disabled"}
                    </p>
                  </div>
                </div>
                
                {schedule.backupType && (
                  <div className="flex items-start space-x-2">
                    <div className={`h-5 w-5 mt-0.5 rounded-full flex items-center justify-center 
                      ${schedule.backupType === 'incremental' ? 'bg-blue-100 text-blue-600' : 'bg-green-100 text-green-600'}`}>
                      {schedule.backupType === 'incremental' ? 'I' : 'F'}
                    </div>
                    <div>
                      <p className="font-medium">Backup Type</p>
                      <p className="text-sm text-muted-foreground capitalize">
                        {schedule.backupType} 
                        {schedule.backupType === 'incremental' && schedule.fullBackupFrequency && (
                          <span> (Full backup every {schedule.fullBackupFrequency} backups)</span>
                        )}
                      </p>
                    </div>
                  </div>
                )}
                
                {schedule.retentionCount && (
                  <div className="flex items-start space-x-2">
                    <div className="h-5 w-5 mt-0.5 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center">R</div>
                    <div>
                      <p className="font-medium">Retention</p>
                      <p className="text-sm text-muted-foreground">
                        Keep {schedule.retentionCount} backups
                      </p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BackupSchedulePage;
