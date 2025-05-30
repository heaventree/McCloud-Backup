import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { BackupSchedule, Site, StorageProvider } from "@/lib/types";
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
  DialogClose
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
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
  
  const { data: storageProviders } = useQuery({
    queryKey: ["/api/storage-providers"],
  });

  // Define form schema for adding/editing backup schedule
  const scheduleFormSchema = z.object({
    siteId: z.preprocess(
      (val) => parseInt(String(val), 10),
      z.number().positive("Site selection is required")
    ),
    storageProviderId: z.preprocess(
      (val) => parseInt(String(val), 10),
      z.number().positive("Storage provider selection is required")
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
      storageProviderId: undefined,
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
  
  // Get storage provider name by ID
  const getStorageProviderName = (providerId: number) => {
    if (!storageProviders) return "Unknown Provider";
    const provider = storageProviders.find((provider: StorageProvider) => provider.id === providerId);
    return provider ? provider.name : "Unknown Provider";
  };

  // Format schedule frequency for display
  const formatSchedule = (schedule: BackupSchedule) => {
    let schedule_text = "";
    
    if (!schedule || !schedule.frequency) {
      return "Custom schedule";
    }
    
    // Default values if not set
    const hourOfDay = schedule.hourOfDay || 0;
    const minuteOfHour = schedule.minuteOfHour || 0;
    
    switch(schedule.frequency) {
      case "hourly":
        schedule_text = `Every hour at ${minuteOfHour} minutes past the hour`;
        break;
      case "daily":
        schedule_text = `Daily at ${String(hourOfDay).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}`;
        break;
      case "weekly":
        const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
        const day = schedule.dayOfWeek !== null && schedule.dayOfWeek !== undefined ? days[schedule.dayOfWeek] : "Sunday";
        schedule_text = `Every ${day} at ${String(hourOfDay).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}`;
        break;
      case "monthly":
        schedule_text = `Monthly on day 1 at ${String(hourOfDay).padStart(2, '0')}:${String(minuteOfHour).padStart(2, '0')}`;
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
          <DialogContent className="sm:max-w-3xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <DialogHeader>
              <DialogTitle className="text-xl font-semibold text-gray-800 dark:text-gray-100">Create Backup Schedule</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FormField
                      control={form.control}
                      name="siteId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300">Site</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                <SelectValue placeholder="Select a site" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                              {sites && sites.map((site: Site) => (
                                <SelectItem key={site.id} value={site.id.toString()}>
                                  {site.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="storageProviderId"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel className="text-gray-700 dark:text-gray-300">Storage Provider</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value?.toString()}
                          >
                            <FormControl>
                              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                <SelectValue placeholder="Select a storage provider" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                              {storageProviders && storageProviders.map((provider: StorageProvider) => (
                                <SelectItem key={provider.id} value={provider.id.toString()}>
                                  {provider.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="frequency"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel className="text-gray-700 dark:text-gray-300">Frequency</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                <SelectValue placeholder="Select frequency" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                              <SelectItem value="hourly">Hourly</SelectItem>
                              <SelectItem value="daily">Daily</SelectItem>
                              <SelectItem value="weekly">Weekly</SelectItem>
                              <SelectItem value="monthly">Monthly</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    {form.watch('frequency') === 'weekly' && (
                      <FormField
                        control={form.control}
                        name="dayOfWeek"
                        render={({ field }) => (
                          <FormItem className="mt-4">
                            <FormLabel className="text-gray-700 dark:text-gray-300">Day of Week</FormLabel>
                            <Select 
                              onValueChange={field.onChange} 
                              defaultValue={field.value?.toString() || "0"}
                            >
                              <FormControl>
                                <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                  <SelectValue placeholder="Select day" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                <SelectItem value="0">Sunday</SelectItem>
                                <SelectItem value="1">Monday</SelectItem>
                                <SelectItem value="2">Tuesday</SelectItem>
                                <SelectItem value="3">Wednesday</SelectItem>
                                <SelectItem value="4">Thursday</SelectItem>
                                <SelectItem value="5">Friday</SelectItem>
                                <SelectItem value="6">Saturday</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />
                    )}

                    <div className="flex space-x-4 mt-4">
                      {form.watch('frequency') !== 'hourly' && (
                        <FormField
                          control={form.control}
                          name="hourOfDay"
                          render={({ field }) => (
                            <FormItem className="flex-1">
                              <FormLabel className="text-gray-700 dark:text-gray-300">Hour (0-23)</FormLabel>
                              <FormControl>
                                <Input type="number" min="0" max="23" {...field} className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
                              </FormControl>
                              <FormMessage className="text-red-500" />
                            </FormItem>
                          )}
                        />
                      )}

                      <FormField
                        control={form.control}
                        name="minuteOfHour"
                        render={({ field }) => (
                          <FormItem className="flex-1">
                            <FormLabel className="text-gray-700 dark:text-gray-300">Minute (0-59)</FormLabel>
                            <FormControl>
                              <Input type="number" min="0" max="59" {...field} className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200" />
                            </FormControl>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div>
                    <FormField
                      control={form.control}
                      name="backupType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-gray-700 dark:text-gray-300">Backup Type</FormLabel>
                          <Select 
                            onValueChange={field.onChange} 
                            defaultValue={field.value}
                          >
                            <FormControl>
                              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                <SelectValue placeholder="Select backup type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                              <SelectItem value="full">Full</SelectItem>
                              <SelectItem value="incremental">Incremental</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormDescription className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                            Full backups contain all files. Incremental backups only store changes since the last full backup.
                          </FormDescription>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />
                    
                    {form.watch('backupType') === 'incremental' && (
                      <FormField
                        control={form.control}
                        name="fullBackupFrequency"
                        render={({ field }) => (
                          <FormItem className="mt-4">
                            <FormLabel className="text-gray-700 dark:text-gray-300">Full Backup Frequency</FormLabel>
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
                                className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                              />
                            </FormControl>
                            <FormDescription className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                              Number of incremental backups before creating a new full backup
                            </FormDescription>
                            <FormMessage className="text-red-500" />
                          </FormItem>
                        )}
                      />
                    )}
                    
                    <FormField
                      control={form.control}
                      name="retentionCount"
                      render={({ field }) => (
                        <FormItem className="mt-4">
                          <FormLabel className="text-gray-700 dark:text-gray-300">Number of Backups to Keep</FormLabel>
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
                              className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                            />
                          </FormControl>
                          <FormDescription className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                            Older backups beyond this number will be automatically deleted
                          </FormDescription>
                          <FormMessage className="text-red-500" />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="enabled"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border border-gray-300 dark:border-gray-600 p-3 shadow-sm mt-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-gray-700 dark:text-gray-300">Enabled</FormLabel>
                            <FormDescription className="text-gray-500 dark:text-gray-400 text-xs">
                              Schedule will run automatically when enabled
                            </FormDescription>
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
                  </div>
                </div>

                <Button 
                  type="submit" 
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white" 
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
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full flex items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300">
                          <Settings className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle className="text-gray-800 dark:text-gray-100">Edit Backup Schedule</DialogTitle>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                            Modify the backup schedule settings below.
                          </p>
                        </DialogHeader>
                        <div className="space-y-4 py-3">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site</label>
                            <Select defaultValue={schedule.siteId ? schedule.siteId.toString() : ''} disabled>
                              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                <SelectValue>{getSiteName(schedule.siteId)}</SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600"></SelectContent>
                            </Select>
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
                            <Select defaultValue={schedule.frequency || 'daily'}>
                              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                <SelectValue>{schedule.frequency ? schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1) : 'Daily'}</SelectValue>
                              </SelectTrigger>
                              <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                <SelectItem value="hourly">Hourly</SelectItem>
                                <SelectItem value="daily">Daily</SelectItem>
                                <SelectItem value="weekly">Weekly</SelectItem>
                                <SelectItem value="monthly">Monthly</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {schedule.backupType && (
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Backup Type</label>
                              <Select defaultValue={schedule.backupType || 'full'}>
                                <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                  <SelectValue>{schedule.backupType ? schedule.backupType.charAt(0).toUpperCase() + schedule.backupType.slice(1) : 'Full'}</SelectValue>
                                </SelectTrigger>
                                <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                  <SelectItem value="full">Full</SelectItem>
                                  <SelectItem value="incremental">Incremental</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          )}
                        </div>
                        <div className="flex justify-end space-x-2 mt-4">
                          <DialogClose asChild>
                            <Button variant="outline" className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600">Cancel</Button>
                          </DialogClose>
                          <DialogClose asChild>
                            <Button className="bg-blue-600 hover:bg-blue-700 text-white">Save Changes</Button>
                          </DialogClose>
                        </div>
                      </DialogContent>
                    </Dialog>
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
                
                <div className="flex items-start space-x-2">
                  <div className="h-5 w-5 mt-0.5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center">S</div>
                  <div>
                    <p className="font-medium">Storage Provider</p>
                    <p className="text-sm text-muted-foreground">
                      {getStorageProviderName(schedule.storageProviderId)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default BackupSchedulePage;
