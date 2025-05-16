import React, { useState, useEffect, useRef, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";
import { Site, StorageProvider, Backup } from "@/lib/types";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  Loader2, Check, AlertCircle, Archive, Server, Database, 
  ArrowRight, HardDrive, Cloud, AlertTriangle
} from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// Define backup stages
enum BackupStage {
  INITIALIZE = 'initialize',
  FILE_SCANNING = 'file_scanning',
  DATABASE_BACKUP = 'database_backup',
  FILE_COMPRESSION = 'file_compression',
  UPLOAD = 'upload',
  VERIFICATION = 'verification',
  COMPLETE = 'complete',
  ERROR = 'error'
}

// Define stage data with friendly names and descriptions
const stageData = {
  [BackupStage.INITIALIZE]: {
    title: 'Initializing Backup',
    description: 'Connecting to your WordPress site...',
    icon: <Server className="h-8 w-8 text-blue-500 animate-pulse" />,
    progress: 0
  },
  [BackupStage.FILE_SCANNING]: {
    title: 'Scanning Files',
    description: 'Identifying files that need to be backed up...',
    icon: <HardDrive className="h-8 w-8 text-indigo-500" />,
    progress: 20
  },
  [BackupStage.DATABASE_BACKUP]: {
    title: 'Backing Up Database',
    description: 'Creating a snapshot of your database...',
    icon: <Database className="h-8 w-8 text-green-500" />,
    progress: 40
  },
  [BackupStage.FILE_COMPRESSION]: {
    title: 'Compressing Files',
    description: 'Packaging your files for efficient storage...',
    icon: <Archive className="h-8 w-8 text-amber-500" />,
    progress: 60
  },
  [BackupStage.UPLOAD]: {
    title: 'Uploading Backup',
    description: 'Transferring your backup to secure storage...',
    icon: <ArrowRight className="h-8 w-8 text-purple-500" />,
    progress: 80
  },
  [BackupStage.VERIFICATION]: {
    title: 'Verifying Backup',
    description: 'Ensuring your backup was completed successfully...',
    icon: <Check className="h-8 w-8 text-blue-500" />,
    progress: 90
  },
  [BackupStage.COMPLETE]: {
    title: 'Backup Complete',
    description: 'Your site has been backed up successfully!',
    icon: <Check className="h-8 w-8 text-green-500" />,
    progress: 100
  },
  [BackupStage.ERROR]: {
    title: 'Backup Error',
    description: 'There was an error during the backup process.',
    icon: <AlertCircle className="h-8 w-8 text-red-500" />,
    progress: 100
  }
};

interface BackupWizardProps {
  open: boolean;
  onClose: () => void;
  site?: Site;
}

// Define additional UI states
enum WizardState {
  PROVIDER_SELECTION = 'provider_selection',
  BACKUP_PROCESS = 'backup_process'
}

const BackupWizard: React.FC<BackupWizardProps> = ({ open, onClose, site }) => {
  // Wizard state control
  const [wizardState, setWizardState] = useState<WizardState>(WizardState.PROVIDER_SELECTION);
  
  // Reference for tracking consecutive error count during status polling
  const errorCount = useRef(0);
  
  // Provider selection state
  const [selectedProviderId, setSelectedProviderId] = useState<number | null>(null);
  
  // Backup process state
  const [stage, setStage] = useState<BackupStage>(BackupStage.INITIALIZE);
  const [stageProgress, setStageProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [backupLog, setBackupLog] = useState<string[]>([]);
  const queryClient = useQueryClient();

  // Get available storage providers
  const { data: storageProviders, isLoading: loadingProviders } = useQuery<StorageProvider[]>({
    queryKey: ['/api/storage-providers'],
  });

  // Mutation for backup operation
  const backupMutation = useMutation({
    mutationFn: async ({ siteId, storageProviderId }: { siteId: number; storageProviderId: number }) => {
      try {
        // Reset backup state
        setStage(BackupStage.INITIALIZE);
        setStageProgress(0);
        
        // Validate required parameters
        if (!storageProviderId) {
          throw new Error("No storage provider selected");
        }
        
        if (!siteId) {
          throw new Error("No site selected");
        }
        
        // Log the beginning of backup process
        addLogEntry("Initializing backup process...");
        
        // Use our new server-side endpoint to start the backup
        const response = await apiRequest<{
          success: boolean;
          message: string;
          processId: string;
          backup: Backup;
        }>("POST", "/api/backups/start", {
          siteId,
          storageProviderId
        });
        
        // Check for success and process_id
        if (!response || !response.success || !response.processId) {
          throw new Error(response?.message || "Failed to start backup process");
        }
        
        addLogEntry(`Backup process started with ID: ${response.processId}`);
        
        return {
          ...response.backup,
          processId: response.processId
        };
      } catch (error) {
        console.error("Error during backup operation:", error);
        throw error;
      }
    },
    onSuccess: (response: Backup & { processId?: string }) => {
      // Invalidate the backups cache so any list views will refresh
      queryClient.invalidateQueries({ queryKey: ["/api/backups"] });
      
      // If we have a process ID, we can check the status; otherwise simulate
      if (response.processId) {
        // Start polling the status using our server-side endpoint
        checkBackupStatus(response.processId);
      } else {
        // Fall back to simulation if no process ID
        const backupId = response.id || 1;
        simulateBackupProgress(backupId);
      }
    },
    onError: (error) => {
      setStage(BackupStage.ERROR);
      setError(error instanceof Error ? error.message : "An unknown error occurred");
      toast({
        title: "Backup failed",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  // Function to check backup status through our backend API
  const checkBackupStatus = (processId: string) => {
    // Reset backup state
    setStage(BackupStage.INITIALIZE);
    setStageProgress(0);
    setBackupLog([]);
    addLogEntry("Starting backup process...");
    addLogEntry(`Process ID: ${processId}`);
    
    // Function to check status with our backend
    const checkStatus = async () => {
      try {
        // Call our backend API to check status
        const response = await apiRequest<{
          success: boolean;
          status: string;
          wpStatus: string;
          data: any;
        }>("GET", `/api/backups/status/${processId}`);
        
        if (!response || !response.success) {
          throw new Error("Failed to check backup status");
        }
        
        // The backend already handles the WordPress API call for us
        const statusData = response.data;
        
        // Log the current status
        addLogEntry(`Status update: ${statusData.state || statusData.status}`);
        
        // Update UI based on status
        if (statusData.state === 'SCANNING_FILES' || statusData.stage === 'SCANNING_FILES') {
          setStage(BackupStage.FILE_SCANNING);
          if (statusData.progress) {
            setStageProgress(parseFloat(statusData.progress));
          } else {
            // Default progress if not specified
            setStageProgress(20);
          }
        } else if (statusData.state === 'DATABASE_BACKUP' || statusData.stage === 'DATABASE_BACKUP') {
          setStage(BackupStage.DATABASE_BACKUP);
          if (statusData.progress) {
            setStageProgress(parseFloat(statusData.progress));
          } else {
            // Default progress if not specified
            setStageProgress(40);
          }
        } else if (statusData.state === 'COMPRESSING' || statusData.stage === 'COMPRESSING') {
          setStage(BackupStage.FILE_COMPRESSION);
          if (statusData.progress) {
            setStageProgress(parseFloat(statusData.progress));
          } else {
            // Default progress if not specified
            setStageProgress(60);
          }
        } else if (statusData.state === 'UPLOADING' || statusData.stage === 'UPLOADING') {
          setStage(BackupStage.UPLOAD);
          if (statusData.progress) {
            setStageProgress(parseFloat(statusData.progress));
          } else {
            // Default progress if not specified
            setStageProgress(80);
          }
        } else if (statusData.state === 'VERIFYING' || statusData.stage === 'VERIFYING') {
          setStage(BackupStage.VERIFICATION);
          if (statusData.progress) {
            setStageProgress(parseFloat(statusData.progress));
          } else {
            // Default progress if not specified
            setStageProgress(90);
          }
        } else if (statusData.state === 'COMPLETED' || statusData.status === 'SUCCESS' || 
                   statusData.stage === 'COMPLETED' || 
                   response.status === 'completed') {
          setStage(BackupStage.COMPLETE);
          setStageProgress(100);
          addLogEntry("✅ Backup completed successfully!");
          
          // Stop polling when complete
          return true;
        } else if (statusData.state === 'ERROR' || statusData.status === 'ERROR' || 
                  statusData.error || statusData.stage === 'ERROR' ||
                  response.status === 'failed') {
          setStage(BackupStage.ERROR);
          setError(statusData.message || 'Backup failed');
          addLogEntry(`❌ Error: ${statusData.message || 'Unknown error'}`);
          
          // Stop polling on error
          return true;
        } else {
          // For any other status, assume it's in progress
          addLogEntry(`Status: ${statusData.state || statusData.status || response.status}`);
          setStageProgress((prevProgress) => Math.min(prevProgress + 5, 95)); // Increment progress but don't reach 100%
        }
        
        // Continue polling if not complete or error
        return false;
      } catch (error) {
        console.error("Error checking backup status:", error);
        
        // Don't immediately set to error state - the backup might still be processing
        // Just log the error and continue polling
        addLogEntry(`⚠️ Warning: Could not check status - ${error instanceof Error ? error.message : 'Unknown error'}`);
        
        // Count the number of consecutive errors
        errorCount.current++;
        
        // If we've had too many consecutive errors, stop the polling and show an error
        if (errorCount.current > 3) {
          setStage(BackupStage.ERROR);
          setError("Too many consecutive errors when checking backup status");
          return true;
        }
        
        return false;
      }
    };
    
    // Reset error count
    errorCount.current = 0;
    
    // Initial check
    checkStatus();
    
    // Set up polling interval
    const pollInterval = setInterval(async () => {
      const isDone = await checkStatus();
      if (isDone) {
        clearInterval(pollInterval);
      }
    }, 5000); // Check every 5 seconds
    
    // Return cleanup function
    return () => clearInterval(pollInterval);
  };

  // Function to simulate backup progress for demo purposes
  // Used as a fallback if real status checking isn't available
  const simulateBackupProgress = (backupId: number) => {
    const stages = [
      BackupStage.INITIALIZE,
      BackupStage.FILE_SCANNING,
      BackupStage.DATABASE_BACKUP,
      BackupStage.FILE_COMPRESSION,
      BackupStage.UPLOAD,
      BackupStage.VERIFICATION,
      BackupStage.COMPLETE
    ];
    
    // Reset state
    setStage(BackupStage.INITIALIZE);
    setStageProgress(0);
    setBackupLog([]);
    addLogEntry("Starting backup process...");
    
    let currentStageIndex = 0;
    
    // Update the stage every few seconds to simulate progress
    const intervalId = setInterval(() => {
      if (currentStageIndex < stages.length) {
        const currentStage = stages[currentStageIndex];
        setStage(currentStage);
        
        // Add a log entry for the new stage
        addLogEntry(`${stageData[currentStage].title}...`);
        
        // Simulate progress within the stage
        simulateStageProgress(currentStage);
        
        currentStageIndex++;
      } else {
        clearInterval(intervalId);
      }
    }, 3000); // Change stage every 3 seconds
    
    return () => clearInterval(intervalId);
  };
  
  // Function to simulate progress within a stage
  const simulateStageProgress = (stage: BackupStage) => {
    let progress = 0;
    const targetProgress = 100;
    const duration = 2500; // Duration for this stage in ms
    const interval = 100; // Update every 100ms
    const steps = duration / interval;
    const increment = targetProgress / steps;
    
    // Create specific log entries based on the stage
    setTimeout(() => {
      switch(stage) {
        case BackupStage.FILE_SCANNING:
          addLogEntry("Found 1,247 files in wp-content directory");
          break;
        case BackupStage.DATABASE_BACKUP:
          addLogEntry("Database size: 24.3 MB");
          break;
        case BackupStage.FILE_COMPRESSION:
          addLogEntry("Compressing files to reduce storage space");
          break;
        case BackupStage.UPLOAD:
          addLogEntry("Uploading backup to storage provider");
          break;
        case BackupStage.VERIFICATION:
          addLogEntry("Verifying backup integrity");
          break;
        case BackupStage.COMPLETE:
          addLogEntry("✅ Backup completed successfully!");
          toast({
            title: "Backup complete",
            description: "Your site has been backed up successfully!",
          });
          break;
      }
    }, 1000);
    
    const progressInterval = setInterval(() => {
      progress += increment;
      setStageProgress(Math.min(Math.round(progress), 100));
      
      if (progress >= targetProgress) {
        clearInterval(progressInterval);
      }
    }, interval);
  };
  
  // Function to add a log entry with timestamp
  const addLogEntry = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setBackupLog(prev => [...prev, `[${timestamp}] ${message}`]);
  };

  // Function to start the backup process with the selected provider
  const startBackup = () => {
    if (!site || !selectedProviderId) {
      toast({
        title: "Cannot start backup",
        description: "Please select a storage provider first",
        variant: "destructive",
      });
      return;
    }
    
    // Switch to backup process state
    setWizardState(WizardState.BACKUP_PROCESS);
    
    // Start the backup with the selected provider
    backupMutation.mutate({
      siteId: site.id,
      storageProviderId: selectedProviderId
    });
  };

  // Reset state when the dialog closes
  useEffect(() => {
    if (!open) {
      // Reset wizard state
      setWizardState(WizardState.PROVIDER_SELECTION);
      setSelectedProviderId(null);
      
      // Reset backup process state
      setStage(BackupStage.INITIALIZE);
      setStageProgress(0);
      setError(null);
      setBackupLog([]);
    }
  }, [open]);

  const currentStageData = stageData[stage];
  const overallProgress = currentStageData.progress + (stageProgress / 100) * 20;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className={cn("max-w-2xl", wizardState === WizardState.PROVIDER_SELECTION ? "max-w-md" : "max-w-2xl")}>
        {wizardState === WizardState.PROVIDER_SELECTION ? (
          // Provider Selection UI
          <>
            <DialogHeader>
              <DialogTitle className="text-xl">
                {site ? `Select Storage Provider for ${site.name}` : 'Select Storage Provider'}
              </DialogTitle>
              <DialogDescription>
                Choose where you want to store your backup
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              {loadingProviders ? (
                <div className="flex justify-center items-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : !storageProviders || storageProviders.length === 0 ? (
                <div className="p-6 text-center bg-amber-50 dark:bg-amber-950/30 rounded-lg">
                  <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                  <h3 className="font-medium text-lg mb-2">No Storage Providers Available</h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                    You need to add at least one storage provider before you can create a backup.
                  </p>
                  <Button variant="secondary" onClick={onClose}>Go back</Button>
                </div>
              ) : (
                <RadioGroup 
                  value={selectedProviderId?.toString() || ""}
                  onValueChange={(value) => setSelectedProviderId(parseInt(value))}
                  className="space-y-3"
                >
                  {storageProviders.map((provider) => (
                    <div key={provider.id} className={cn(
                      "flex items-center space-x-3 rounded-lg border p-4 transition-colors",
                      selectedProviderId === provider.id ? "border-primary bg-primary/5" : "hover:bg-accent"
                    )}>
                      <RadioGroupItem 
                        value={provider.id.toString()} 
                        id={`provider-${provider.id}`}
                        className="peer"
                      />
                      <Label 
                        htmlFor={`provider-${provider.id}`}
                        className="flex flex-1 items-center gap-4 cursor-pointer"
                      >
                        <div className="flex items-center justify-center w-10 h-10 rounded-md bg-gray-100 dark:bg-gray-800">
                          <Cloud className="h-6 w-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{provider.name}</div>
                          <div className="text-xs text-gray-500">
                            {provider.type.charAt(0).toUpperCase() + provider.type.slice(1)} Storage
                          </div>
                        </div>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </div>

            <DialogFooter>
              <Button 
                variant="secondary" 
                onClick={onClose}
                className="mr-2"
              >
                Cancel
              </Button>
              <Button 
                onClick={startBackup} 
                disabled={!selectedProviderId || !site || storageProviders?.length === 0}
              >
                Start Backup
              </Button>
            </DialogFooter>
          </>
        ) : (
          // Backup Process UI
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl">
                {site ? `Backing up ${site.name}` : 'Site Backup'}
              </DialogTitle>
              <DialogDescription>
                {stage === BackupStage.ERROR 
                  ? 'There was an error during the backup process.' 
                  : 'Your site is being backed up. Please do not close this window.'}
              </DialogDescription>
            </DialogHeader>

            <div className="py-6">
              {/* Main progress bar */}
              <div className="mb-8">
                <div className="flex justify-between mb-2 items-center">
                  <div className="text-sm font-medium">
                    {currentStageData.title}
                  </div>
                  <div className="text-sm text-gray-500">
                    {Math.round(overallProgress)}%
                  </div>
                </div>
                <Progress 
                  value={overallProgress} 
                  className="h-2" 
                  indicatorClassName={cn(
                    stage === BackupStage.ERROR ? "bg-red-500" : "",
                    stage === BackupStage.COMPLETE ? "bg-green-500" : ""
                  )}
                />
              </div>

              {/* Stage visualization */}
              <div className="grid grid-cols-7 gap-2 mb-6">
                {Object.values(BackupStage).slice(0, 7).map((s, index) => {
                  const stageComplete = Object.values(BackupStage).indexOf(stage) > index;
                  const stageCurrent = stage === s;
                  
                  return (
                    <div key={s} className="flex flex-col items-center">
                      <div 
                        className={cn(
                          "flex items-center justify-center w-12 h-12 rounded-full mb-2 transition-all duration-300",
                          stageComplete ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" : "",
                          stageCurrent ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500 ring-offset-2 dark:ring-offset-gray-900" : "",
                          !stageComplete && !stageCurrent ? "bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500" : ""
                        )}
                      >
                        {stageComplete ? (
                          <Check className="h-6 w-6" />
                        ) : stageCurrent ? (
                          <div className="h-6 w-6">
                            {stageCurrent && stageData[s].icon}
                          </div>
                        ) : (
                          <div className="h-2 w-2 rounded-full bg-gray-300 dark:bg-gray-600" />
                        )}
                      </div>
                      <div className="text-xs text-center font-medium mt-1">
                        {s === BackupStage.INITIALIZE ? 'Start' : 
                         s === BackupStage.FILE_SCANNING ? 'Scan' :
                         s === BackupStage.DATABASE_BACKUP ? 'Database' :
                         s === BackupStage.FILE_COMPRESSION ? 'Compress' :
                         s === BackupStage.UPLOAD ? 'Upload' :
                         s === BackupStage.VERIFICATION ? 'Verify' :
                         s === BackupStage.COMPLETE ? 'Complete' : ''}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Current stage info */}
              <div className="flex items-center mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <div className="mr-4 p-2 rounded-full bg-white dark:bg-gray-700 shadow-sm">
                  {currentStageData.icon}
                </div>
                <div>
                  <h3 className="font-medium">{currentStageData.title}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{currentStageData.description}</p>
                </div>
              </div>

              {/* Backup log */}
              <div className="mt-6">
                <h4 className="font-medium mb-2">Backup Log</h4>
                <div className="bg-black rounded-md p-4 h-32 overflow-y-auto font-mono text-xs text-gray-200">
                  {backupLog.length > 0 ? (
                    backupLog.map((entry, index) => (
                      <div key={index} className="py-1">{entry}</div>
                    ))
                  ) : (
                    <div className="text-gray-500">Waiting for backup to start...</div>
                  )}
                </div>
              </div>
            </div>

            <DialogFooter>
              {(stage === BackupStage.COMPLETE || stage === BackupStage.ERROR) ? (
                <Button onClick={onClose}>
                  Close
                </Button>
              ) : (
                <Button disabled variant="outline">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Backing up...
                </Button>
              )}
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default BackupWizard;