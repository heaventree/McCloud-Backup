import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Site, BackupSchedule, HealthCheckResult } from "@/lib/types";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import GitHubRepoList from "@/components/github/github-repo-list";
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
import { useToast } from "@/hooks/use-toast";
import AddSiteForm from "@/components/sites/add-site-form";
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
  Play,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  HardDrive,
  Activity,
  Github
} from "lucide-react";

export default function SiteManagementSimple() {
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

      <Tabs defaultValue="wordpress">
        <TabsList className="mb-6">
          <TabsTrigger value="wordpress" className="flex items-center">
            <Globe className="h-4 w-4 mr-2" />
            WordPress Sites
          </TabsTrigger>
          <TabsTrigger value="github" className="flex items-center">
            <Github className="h-4 w-4 mr-2" />
            GitHub Repositories
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="wordpress">
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
                                      {/* Form fields would go here */}
                                    </form>
                                  </Form>
                                </DialogContent>
                              </Dialog>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              {siteSchedules.map((schedule: BackupSchedule) => (
                                <div key={schedule.id} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md">
                                  <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 mt-1">
                                      <CalendarClock className="h-5 w-5 text-blue-500 dark:text-blue-400" />
                                    </div>
                                    <div>
                                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">{formatSchedule(schedule)}</h4>
                                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        Type: {schedule.backupType === "full" ? "Full" : "Incremental"} • Provider: {getStorageProviderName(schedule.storageProviderId)}
                                      </p>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-8 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                      onClick={() => runBackupMutation.mutate({
                                        siteId: site.id,
                                        storageProviderId: schedule.storageProviderId,
                                        type: schedule.backupType
                                      })}
                                      disabled={runBackupMutation.isPending}
                                    >
                                      {runBackupMutation.isPending ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <>
                                          <Play className="h-3.5 w-3.5 mr-1" />
                                          Run Now
                                        </>
                                      )}
                                    </Button>
                                    <div 
                                      className="flex items-center"
                                      onClick={() => toggleScheduleMutation.mutate({
                                        id: schedule.id,
                                        enabled: !schedule.enabled
                                      })}
                                    >
                                      <Switch 
                                        checked={schedule.enabled}
                                        className="data-[state=checked]:bg-green-600 dark:data-[state=checked]:bg-green-500"
                                        disabled={toggleScheduleMutation.isPending}
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                              <div className="pt-2 flex justify-end">
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
                                      size="sm"
                                      className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                      onClick={() => {
                                        setSelectedSiteId(site.id);
                                        setIsAddingSchedule(true);
                                        form.setValue('siteId', site.id);
                                      }}
                                    >
                                      <Plus className="h-3.5 w-3.5 mr-1" />
                                      Add Schedule
                                    </Button>
                                  </DialogTrigger>
                                </Dialog>
                              </div>
                            </div>
                          )}
                        </CardContent>
                        <div className="px-5 py-2 bg-gray-50 dark:bg-gray-700/20 border-t border-gray-200 dark:border-gray-700">
                          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300">Quick Actions</h3>
                        </div>
                        <CardFooter className="px-5 py-4 flex flex-wrap gap-2">
                          <Button
                            variant="outline"
                            className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                            onClick={() => {
                              setHealthCheckSite(site);
                              setIsHealthCheckOpen(true);
                            }}
                          >
                            <Activity className="mr-1 h-4 w-4" />
                            Run Health Check
                          </Button>
                          <Button
                            variant="outline"
                            className="border-indigo-200 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-900/20 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                            disabled={!Array.isArray(storageProviders) || storageProviders.length === 0}
                            onClick={() => {
                              if (Array.isArray(storageProviders) && storageProviders.length > 0) {
                                runBackupMutation.mutate({
                                  siteId: site.id,
                                  storageProviderId: storageProviders[0].id,
                                  type: "full"
                                });
                              }
                            }}
                          >
                            <HardDrive className="mr-1 h-4 w-4" />
                            Instant Backup
                          </Button>
                        </CardFooter>
                      </>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="github">
          <GitHubRepoList />
        </TabsContent>
      </Tabs>
      
      {/* Health Check Dialog */}
      <Dialog open={isHealthCheckOpen} onOpenChange={setIsHealthCheckOpen}>
        <DialogContent className="max-w-5xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Site Health Check: {healthCheckSite?.name}</DialogTitle>
            <DialogDescription>
              Checking the health and performance of your WordPress site
            </DialogDescription>
          </DialogHeader>
          <div className="py-6 text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Running health check...</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Add the HealthCheck component as needed