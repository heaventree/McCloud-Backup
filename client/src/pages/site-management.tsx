import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Site, BackupSchedule, HealthCheckResult } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription,
  CardFooter
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogDescription
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { 
  Form, 
  FormControl, 
  FormDescription, 
  FormField, 
  FormItem, 
  FormLabel, 
  FormMessage 
} from "@/components/ui/form";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import AddSiteForm from "@/components/sites/add-site-form";
import GitHubRepoList from "@/components/github/github-repo-list";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format, formatDistanceToNow } from "date-fns";
import { useForm } from "react-hook-form";
import { 
  Plus, 
  Search, 
  Loader2, 
  Globe, 
  ExternalLink, 
  Key, 
  Trash,
  Clock,
  Archive,
  Settings,
  Copy,
  CalendarClock,
  Power,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Activity,
  Github
} from "lucide-react";

const SiteManagement = () => {
  const { toast } = useToast();
  const [isAddingSite, setIsAddingSite] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [siteToDelete, setSiteToDelete] = useState<Site | null>(null);
  const [selectedSiteId, setSelectedSiteId] = useState<number | null>(null);
  const [isAddingSchedule, setIsAddingSchedule] = useState(false);
  const [expandedSites, setExpandedSites] = useState<number[]>([]);
  const [healthCheckSite, setHealthCheckSite] = useState<Site | null>(null);
  const [isHealthCheckOpen, setIsHealthCheckOpen] = useState(false);

  // Fetch all required data
  const { data: sites, isLoading: sitesLoading, isError: sitesError } = useQuery({
    queryKey: ["/api/sites"],
  });

  const { data: backups } = useQuery({
    queryKey: ["/api/backups"],
  });

  const { data: schedules } = useQuery({
    queryKey: ["/api/backup-schedules"],
  });

  const { data: storageProviders } = useQuery({
    queryKey: ["/api/storage-providers"],
  });

  // Define schedule form schema for adding/editing backup schedule
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
      frequency: "daily",
      dayOfWeek: null,
      hourOfDay: 0,
      minuteOfHour: 0,
      backupType: "full",
      fullBackupFrequency: null,
      retentionCount: null,
      enabled: true,
      storageProviderId: undefined,
    },
  });

  // Mutations
  const deleteSiteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/sites/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sites"] });
      toast({
        title: "Site deleted",
        description: "The site has been removed successfully",
      });
      setSiteToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error deleting site",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
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

  const runBackupMutation = useMutation({
    mutationFn: async ({ siteId, storageProviderId, type }: { siteId: number, storageProviderId: number, type: string }) => {
      const response = await apiRequest("POST", "/api/backups", {
        siteId,
        storageProviderId,
        type,
        status: "pending"
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      toast({
        title: "Backup started",
        description: "A new backup job has been initiated",
      });
    },
    onError: (error) => {
      toast({
        title: "Error starting backup",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });
  
  const runHealthCheckMutation = useMutation({
    mutationFn: async (siteId: number) => {
      const response = await apiRequest("GET", `/api/sites/${siteId}/health-check`);
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Health check completed",
        description: "Site health information has been retrieved",
      });
    },
    onError: (error) => {
      toast({
        title: "Error running health check",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Handle form submission
  const onSubmit = (data: ScheduleFormValues) => {
    createScheduleMutation.mutate(data);
  };

  // Filter sites based on search term
  const filteredSites = sites && Array.isArray(sites) 
    ? sites.filter((site: Site) => 
        site.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        site.url.toLowerCase().includes(searchTerm.toLowerCase())
      ) 
    : [];

  // Get last backup for a site
  const getLastBackupForSite = (siteId: number) => {
    if (!backups || !Array.isArray(backups)) return null;
    
    const siteBackups = backups
      .filter((backup: any) => backup.siteId === siteId)
      .sort((a: any, b: any) => 
        new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
      );
    
    return siteBackups.length > 0 ? siteBackups[0] : null;
  };

  // Get schedules for a site
  const getSchedulesForSite = (siteId: number) => {
    if (!schedules || !Array.isArray(schedules)) return [];
    return schedules.filter((schedule: BackupSchedule) => schedule.siteId === siteId);
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

  // Toggle site expansion
  const toggleSiteExpansion = (siteId: number) => {
    if (expandedSites.includes(siteId)) {
      setExpandedSites(expandedSites.filter(id => id !== siteId));
    } else {
      setExpandedSites([...expandedSites, siteId]);
    }
  };

  // Get storage provider name
  const getStorageProviderName = (providerId: number) => {
    if (!storageProviders || !Array.isArray(storageProviders)) return "Unknown";
    const provider = storageProviders.find((p: any) => p.id === providerId);
    return provider ? provider.name : "Unknown";
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Site Management</h1>
          <p className="text-gray-500 dark:text-gray-400">Manage your WordPress sites and backup schedules</p>
        </div>
        <Dialog open={isAddingSite} onOpenChange={setIsAddingSite}>
          <DialogTrigger asChild>
            <Button className="mt-4 sm:mt-0 bg-blue-600 hover:bg-blue-700 text-white">
              <Plus className="mr-1 h-4 w-4" />
              Add Site
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
            <DialogHeader>
              <DialogTitle className="text-gray-800 dark:text-gray-100">Add a new site</DialogTitle>
              <DialogDescription className="text-gray-500 dark:text-gray-400">
                Enter the details of the WordPress site you want to backup.
              </DialogDescription>
            </DialogHeader>
            <AddSiteForm onSuccess={() => setIsAddingSite(false)} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500 dark:text-gray-400" />
          <input
            placeholder="Search sites..."
            className="pl-8 w-full h-10 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:border-blue-400 dark:focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:focus:ring-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {sitesLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-blue-400" />
        </div>
      ) : sitesError ? (
        <div className="text-center py-12 text-red-400">
          Failed to load sites
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          {searchTerm ? "No sites match your search" : "No sites added yet"}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredSites.map((site: Site) => {
            const lastBackup = getLastBackupForSite(site.id);
            const siteSchedules = getSchedulesForSite(site.id);
            const isExpanded = expandedSites.includes(site.id);
            
            return (
              <Card key={site.id} className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 overflow-hidden">
                <CardHeader className="px-5 py-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center">
                        <CardTitle className="text-lg font-semibold text-gray-800 dark:text-white">{site.name}</CardTitle>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="ml-2 h-6 w-6 hover:bg-gray-100 dark:hover:bg-gray-700"
                          onClick={() => toggleSiteExpansion(site.id)}
                        >
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-gray-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-gray-400" />
                          )}
                        </Button>
                      </div>
                      <div className="mt-1 flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Globe className="h-3.5 w-3.5 mr-1" />
                        {site.url}
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-blue-600 transition-colors text-gray-600 dark:text-gray-300 hover:text-white"
                        onClick={() => window.open(`https://${site.url}`, '_blank')}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </button>
                      <Dialog>
                        <DialogTrigger asChild>
                          <button 
                            className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors text-gray-600 dark:text-gray-300"
                          >
                            <Settings className="h-4 w-4" />
                          </button>
                        </DialogTrigger>
                        <DialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                          <DialogHeader>
                            <DialogTitle className="text-gray-800 dark:text-gray-100">Edit Site Settings</DialogTitle>
                            <DialogDescription className="text-gray-500 dark:text-gray-400">
                              Update the site details or copy the API key.
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4 py-3">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site Name</label>
                              <Input 
                                defaultValue={site.name}
                                className="w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site URL</label>
                              <Input 
                                defaultValue={site.url}
                                className="w-full border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">API Key</label>
                              <div className="flex">
                                <Input 
                                  value={site.apiKey}
                                  readOnly
                                  className="flex-1 rounded-r-none border-r-0 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                                />
                                <Button
                                  variant="outline"
                                  className="rounded-l-none border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                                  onClick={() => {
                                    navigator.clipboard.writeText(site.apiKey);
                                    toast({
                                      title: "API Key copied",
                                      description: "API Key has been copied to clipboard",
                                    });
                                  }}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
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
                      <AlertDialog open={siteToDelete?.id === site.id} onOpenChange={(open) => !open && setSiteToDelete(null)}>
                        <AlertDialogTrigger asChild>
                          <button 
                            className="h-8 w-8 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-700 hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-500 dark:text-red-400"
                            onClick={() => setSiteToDelete(site)}
                          >
                            <Trash className="h-4 w-4" />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                          <AlertDialogHeader>
                            <AlertDialogTitle className="text-gray-800 dark:text-gray-100">Delete Site</AlertDialogTitle>
                            <AlertDialogDescription className="text-gray-500 dark:text-gray-400">
                              Are you sure you want to delete "{site.name}"? This action cannot be undone and all backup records for this site will be lost.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600">Cancel</AlertDialogCancel>
                            <AlertDialogAction 
                              className="bg-red-600 hover:bg-red-700 text-white"
                              onClick={() => deleteSiteMutation.mutate(site.id)}
                              disabled={deleteSiteMutation.isPending}
                            >
                              {deleteSiteMutation.isPending ? (
                                <>
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                  Deleting...
                                </>
                              ) : (
                                "Delete"
                              )}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Key className="h-3.5 w-3.5 mr-1.5" />
                        <span>API Key: </span>
                        <code className="ml-1 bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono text-gray-700 dark:text-gray-300">
                          {site.apiKey.substring(0, 8)}...
                        </code>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Clock className="h-3.5 w-3.5 mr-1.5" />
                        <span>Added: </span>
                        <span className="ml-1 text-gray-700 dark:text-gray-300">
                          {formatDistanceToNow(new Date(site.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-gray-700/30 p-3 rounded-lg">
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <Archive className="h-3.5 w-3.5 mr-1.5" />
                        <span>Last Backup: </span>
                        <span className="ml-1">
                          {lastBackup ? (
                            <span className={lastBackup.status === "completed" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                              {formatDistanceToNow(new Date(lastBackup.startedAt), { addSuffix: true })}
                            </span>
                          ) : (
                            <span className="text-gray-700 dark:text-gray-300">Never</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <>
                    <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/20 border-t border-gray-200 dark:border-gray-700">
                      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Backup Schedules</h3>
                    </div>
                    <CardContent className="px-5 py-4">
                      {siteSchedules.length === 0 ? (
                        <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                          <AlertCircle className="h-10 w-10 mx-auto mb-2 text-gray-400 dark:text-gray-500" />
                          <p>No backup schedules configured for this site</p>
                          <Dialog open={isAddingSchedule && selectedSiteId === site.id} 
                                 onOpenChange={(open) => {
                                   if (!open) {
                                     setIsAddingSchedule(false);
                                     form.reset();
                                   }
                                 }}>
                            <DialogTrigger asChild>
                              <Button 
                                variant="outline" 
                                className="mt-4 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                onClick={() => {
                                  setSelectedSiteId(site.id);
                                  setIsAddingSchedule(true);
                                  form.setValue('siteId', site.id);
                                }}
                              >
                                <Plus className="mr-1 h-4 w-4" />
                                Add Schedule
                              </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-3xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                              <DialogHeader>
                                <DialogTitle className="text-xl font-semibold text-gray-800 dark:text-gray-100">Create Backup Schedule</DialogTitle>
                                <DialogDescription className="text-gray-500 dark:text-gray-400">
                                  Configure automatic backups for {site.name}
                                </DialogDescription>
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
                                              defaultValue={site.id.toString()}
                                              disabled
                                            >
                                              <FormControl>
                                                <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                                  <SelectValue placeholder={site.name} />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                                <SelectItem value={site.id.toString()}>{site.name}</SelectItem>
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
                                        name="storageProviderId"
                                        render={({ field }) => (
                                          <FormItem>
                                            <FormLabel className="text-gray-700 dark:text-gray-300">Storage Provider</FormLabel>
                                            <Select 
                                              onValueChange={field.onChange} 
                                              defaultValue={field.value?.toString()}
                                            >
                                              <FormControl>
                                                <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                                  <SelectValue placeholder="Select storage provider" />
                                                </SelectTrigger>
                                              </FormControl>
                                              <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                                {storageProviders && Array.isArray(storageProviders) && storageProviders.map((provider: any) => (
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
                                        name="backupType"
                                        render={({ field }) => (
                                          <FormItem className="mt-4">
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

                                  <div className="flex justify-end space-x-2">
                                    <Button 
                                      type="button" 
                                      variant="outline" 
                                      className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600"
                                      onClick={() => {
                                        setIsAddingSchedule(false);
                                        form.reset();
                                      }}
                                    >
                                      Cancel
                                    </Button>
                                    <Button 
                                      type="submit" 
                                      className="bg-blue-600 hover:bg-blue-700 text-white" 
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
                                  </div>
                                </form>
                              </Form>
                            </DialogContent>
                          </Dialog>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          {siteSchedules.map((schedule: BackupSchedule) => (
                            <Card key={schedule.id} className="bg-gray-50 dark:bg-gray-700/20 border-gray-200 dark:border-gray-700">
                              <CardHeader className="pb-2">
                                <div className="flex justify-between items-start">
                                  <CardTitle className="text-base font-medium">
                                    {schedule.frequency.charAt(0).toUpperCase() + schedule.frequency.slice(1)} Backup
                                    {schedule.backupType && (
                                      <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-normal bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 inline-block">
                                        {schedule.backupType.charAt(0).toUpperCase() + schedule.backupType.slice(1)}
                                      </span>
                                    )}
                                  </CardTitle>
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
                                          <DialogDescription className="text-gray-500 dark:text-gray-400">
                                            Modify the backup schedule settings below.
                                          </DialogDescription>
                                        </DialogHeader>
                                        <div className="space-y-4 py-3">
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Site</label>
                                            <Select defaultValue={schedule.siteId ? schedule.siteId.toString() : ''} disabled>
                                              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                                <SelectValue>{site.name}</SelectValue>
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
                                          <div>
                                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Storage Provider</label>
                                            <Select defaultValue={schedule.storageProviderId ? schedule.storageProviderId.toString() : ''}>
                                              <SelectTrigger className="border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200">
                                                <SelectValue>{getStorageProviderName(schedule.storageProviderId)}</SelectValue>
                                              </SelectTrigger>
                                              <SelectContent className="bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 border-gray-300 dark:border-gray-600">
                                                {storageProviders && Array.isArray(storageProviders) && storageProviders.map((provider: any) => (
                                                  <SelectItem key={provider.id} value={provider.id.toString()}>
                                                    {provider.name}
                                                  </SelectItem>
                                                ))}
                                              </SelectContent>
                                            </Select>
                                          </div>
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
                              <CardContent className="pt-2 pb-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="flex items-start space-x-2">
                                  <CalendarClock className="h-5 w-5 text-primary mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium">Schedule</p>
                                    <p className="text-xs text-muted-foreground">{formatSchedule(schedule)}</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start space-x-2">
                                  <HardDrive className="h-5 w-5 text-primary mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium">Storage Provider</p>
                                    <p className="text-xs text-muted-foreground">{getStorageProviderName(schedule.storageProviderId)}</p>
                                  </div>
                                </div>
                                
                                <div className="flex items-start space-x-2">
                                  <Clock className="h-5 w-5 text-primary mt-0.5" />
                                  <div>
                                    <p className="text-sm font-medium">Next Run</p>
                                    <p className="text-xs text-muted-foreground">
                                      {schedule.nextRun ? (
                                        <>
                                          {format(new Date(schedule.nextRun), "MMM d, yyyy HH:mm")}
                                          <span className="ml-1 text-[11px]">
                                            ({formatDistanceToNow(new Date(schedule.nextRun), { addSuffix: true })})
                                          </span>
                                        </>
                                      ) : "Not scheduled"}
                                    </p>
                                  </div>
                                </div>
                                
                                <div className="flex justify-start md:justify-end space-x-2">
                                  <Button 
                                    variant="outline" 
                                    size="sm" 
                                    className="h-8 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800"
                                    onClick={() => {
                                      if (storageProviders && Array.isArray(storageProviders) && storageProviders.length > 0) {
                                        runBackupMutation.mutate({
                                          siteId: site.id,
                                          storageProviderId: schedule.storageProviderId || storageProviders[0].id,
                                          type: schedule.backupType || 'full'
                                        });
                                      } else {
                                        toast({
                                          title: "Cannot run backup",
                                          description: "No storage providers available",
                                          variant: "destructive",
                                        });
                                      }
                                    }}
                                    disabled={runBackupMutation.isPending}
                                  >
                                    {runBackupMutation.isPending ? (
                                      <>
                                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                                        Running...
                                      </>
                                    ) : (
                                      <>Run Now</>
                                    )}
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          ))}
                          <div className="flex justify-center pt-2">
                            <Dialog open={isAddingSchedule && selectedSiteId === site.id} 
                                   onOpenChange={(open) => {
                                     if (!open) {
                                       setIsAddingSchedule(false);
                                       form.reset();
                                     }
                                   }}>
                              <DialogTrigger asChild>
                                <Button 
                                  variant="outline" 
                                  className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                  onClick={() => {
                                    setSelectedSiteId(site.id);
                                    setIsAddingSchedule(true);
                                    form.setValue('siteId', site.id);
                                  }}
                                >
                                  <Plus className="mr-1 h-4 w-4" />
                                  Add Another Schedule
                                </Button>
                              </DialogTrigger>
                              <DialogContent className="sm:max-w-3xl bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100">
                                {/* Schedule form content (same as above) */}
                                <DialogHeader>
                                  <DialogTitle className="text-xl font-semibold text-gray-800 dark:text-gray-100">Create Another Backup Schedule</DialogTitle>
                                  <DialogDescription className="text-gray-500 dark:text-gray-400">
                                    Add an additional backup schedule for {site.name}
                                  </DialogDescription>
                                </DialogHeader>
                                {/* Form is the same as the one above */}
                                <Form {...form}>
                                  {/* Form content (same as above) */}
                                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                    {/* Form fields (same as above) */}
                                    {/* ... */}
                                    <div className="flex justify-end space-x-2">
                                      <Button 
                                        type="button" 
                                        variant="outline" 
                                        className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600"
                                        onClick={() => {
                                          setIsAddingSchedule(false);
                                          form.reset();
                                        }}
                                      >
                                        Cancel
                                      </Button>
                                      <Button 
                                        type="submit" 
                                        className="bg-blue-600 hover:bg-blue-700 text-white" 
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
                                    </div>
                                  </form>
                                </Form>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </>
                )}
                <CardFooter className="px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/20 flex items-center justify-between">
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    {isExpanded ? 
                      `${siteSchedules.length} backup schedule(s)` :
                      siteSchedules.length === 0 ? 
                        "No backup schedules" : 
                        `${siteSchedules.length} backup schedule(s)`}
                  </div>
                  <div className="flex space-x-2">
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className={`h-8 text-xs transition-colors ${!isExpanded ? 'bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800' : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 border-gray-200 dark:border-gray-600'}`}
                      onClick={() => toggleSiteExpansion(site.id)}
                    >
                      {isExpanded ? (
                        <>
                          <ChevronUp className="h-3.5 w-3.5 mr-1" />
                          Collapse
                        </>
                      ) : (
                        <>
                          <ChevronDown className="h-3.5 w-3.5 mr-1" />
                          Manage Schedules
                        </>
                      )}
                    </Button>
                    <Button 
                      size="sm" 
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white"
                      onClick={() => {
                        if (storageProviders && Array.isArray(storageProviders) && storageProviders.length > 0) {
                          runBackupMutation.mutate({
                            siteId: site.id,
                            storageProviderId: storageProviders[0].id,
                            type: 'full'
                          });
                        } else {
                          toast({
                            title: "Cannot run backup",
                            description: "No storage providers available",
                            variant: "destructive",
                          });
                        }
                      }}
                      disabled={runBackupMutation.isPending}
                    >
                      {runBackupMutation.isPending ? (
                        <>
                          <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                          Running Backup...
                        </>
                      ) : (
                        "Run Backup Now"
                      )}
                    </Button>
                    <Button 
                      variant="outline"
                      size="sm" 
                      className="h-8 text-xs bg-gray-50 hover:bg-gray-100 dark:bg-gray-700/50 dark:hover:bg-gray-700 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"
                      onClick={() => {
                        setHealthCheckSite(site);
                        setIsHealthCheckOpen(true);
                      }}
                    >
                      <Activity className="mr-1 h-3.5 w-3.5" />
                      Health Check
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
      
      {/* Health Check Dialog */}
      <HealthCheck 
        site={healthCheckSite} 
        open={isHealthCheckOpen} 
        onOpenChange={setIsHealthCheckOpen} 
      />
    </div>
  );
};

export default SiteManagement;

// Adding the HealthCheck component to display health check results
export function HealthCheck({ site, open, onOpenChange }: { site: Site | null, open: boolean, onOpenChange: (open: boolean) => void }) {
  const { toast } = useToast();
  const [healthData, setHealthData] = useState<HealthCheckResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  
  const runHealthCheck = async () => {
    if (!site) return;
    
    setIsLoading(true);
    try {
      const response = await fetch(`/api/sites/${site.id}/health-check`);
      const data = await response.json();
      setHealthData(data);
    } catch (error) {
      toast({
        title: "Error running health check",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };
  
  // Run health check when dialog opens
  useEffect(() => {
    if (open && site) {
      runHealthCheck();
    }
  }, [open, site]);
  
  if (!site) return null;

  // Utility function to get status color
  const getStatusColor = (score: number) => {
    return score > 80 ? "text-green-500" : score > 50 ? "text-amber-500" : "text-red-500";
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Site Health Check: {site.name}</DialogTitle>
          <DialogDescription>
            Checking the health and performance of your WordPress site.
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mb-4" />
            <p>Running health check...</p>
          </div>
        ) : healthData ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 py-3">
            {/* Health Summary Column */}
            <div className="md:col-span-1">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Health Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium">Overall Health</span>
                        <span className="text-xs font-medium">{healthData.overall_health?.score || 0}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div 
                          className={`h-full rounded-full ${
                            (healthData.overall_health?.score || 0) > 80 
                              ? "bg-green-500" 
                              : (healthData.overall_health?.score || 0) > 50 
                                ? "bg-amber-500" 
                                : "bg-red-500"
                          }`}
                          style={{ width: `${healthData.overall_health?.score || 0}%` }}
                        />
                      </div>
                    </div>
                    
                    <div>
                      <h4 className="text-xs font-medium mb-2">Component Health</h4>
                      <div className="space-y-2">
                        {healthData.overall_health?.components && Object.entries(healthData.overall_health.components)
                          .sort(([, a], [, b]) => (a.score < b.score ? -1 : 1))
                          .slice(0, 5)
                          .map(([key, value], index) => (
                            <div key={index} className="flex items-center justify-between">
                              <span className="text-xs muted-foreground capitalize">{key.replace('_', ' ')}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full ${
                                      value.score > 80 
                                        ? "bg-green-500" 
                                        : value.score > 50 
                                          ? "bg-amber-500" 
                                          : "bg-red-500"
                                    }`}
                                    style={{ width: `${value.score}%` }}
                                  />
                                </div>
                                <span className={`text-xs font-medium ${getStatusColor(value.score)}`}>
                                  {value.score}%
                                </span>
                              </div>
                            </div>
                          ))
                        }
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Main content area - 3 columns */}
            <div className="md:col-span-3">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card>
                  <CardHeader>
                    <CardTitle>WordPress</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Version</span>
                        <span className="font-medium">{healthData.wordpress?.version || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Updates</span>
                        <span className={`font-medium ${!healthData.wordpress?.is_latest ? "text-amber-500" : "text-green-500"}`}>
                          {!healthData.wordpress?.is_latest ? "Available" : "Up to date"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Multisite</span>
                        <span className="font-medium">{healthData.wordpress?.multisite ? "Yes" : "No"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Database</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Size</span>
                        <span className="font-medium">{healthData.database?.size_formatted || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Tables</span>
                        <span className="font-medium">{healthData.database?.tables_count || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Prefix</span>
                        <span className="font-medium">{healthData.database?.prefix || "wp_"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Security</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">SSL</span>
                        <span className={`font-medium ${healthData.security?.ssl ? "text-green-500" : "text-red-500"}`}>
                          {healthData.security?.ssl ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">File Editing</span>
                        <span className={`font-medium ${!healthData.security?.file_editing ? "text-green-500" : "text-amber-500"}`}>
                          {!healthData.security?.file_editing ? "Disabled" : "Enabled"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Vulnerabilities</span>
                        <span className={`font-medium ${(healthData.security?.vulnerabilities?.total || 0) > 0 ? "text-red-500" : "text-green-500"}`}>
                          {healthData.security?.vulnerabilities?.total || "0"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>PHP</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Version</span>
                        <span className={`font-medium ${healthData.php?.is_supported ? "text-green-500" : "text-amber-500"}`}>
                          {healthData.php?.version || "Unknown"}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Memory Limit</span>
                        <span className="font-medium">{healthData.php?.memory_limit || "Unknown"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Max Execution</span>
                        <span className="font-medium">{healthData.php?.max_execution_time || "Unknown"}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Plugins</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Active</span>
                        <span className="font-medium">{healthData.plugins?.active || "0"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Inactive</span>
                        <span className="font-medium">{healthData.plugins?.inactive || "0"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Updates Needed</span>
                        <span className={`font-medium ${(healthData.plugins?.updates_needed || 0) > 0 ? "text-amber-500" : "text-green-500"}`}>
                          {healthData.plugins?.updates_needed || "0"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardHeader>
                    <CardTitle>Performance</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Post Revisions</span>
                        <span className="font-medium">{healthData.performance?.post_revisions || "0"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Transients</span>
                        <span className="font-medium">{healthData.performance?.transients || "0"}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="muted-foreground">Object Cache</span>
                        <span className={`font-medium ${healthData.performance?.cache?.object_cache ? "text-green-500" : "text-amber-500"}`}>
                          {healthData.performance?.cache?.object_cache ? "Enabled" : "Disabled"}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            No health data available. Click "Run Health Check" to analyze your site.
          </div>
        )}
        
        <div className="flex justify-between">
          <Button 
            variant="outline" 
            onClick={runHealthCheck}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                Refresh Health Check
              </>
            )}
          </Button>
          <DialogClose asChild>
            <Button>
              Close
            </Button>
          </DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}