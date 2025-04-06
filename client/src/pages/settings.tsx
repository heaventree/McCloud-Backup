import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RefreshCw, Globe, Clock, ShieldAlert, User, FileText, Database, HardDrive, Lock } from "lucide-react";

const SettingsPage = () => {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  
  // Form state
  const [compressionType, setCompressionType] = useState("zip");
  const [backupRetention, setBackupRetention] = useState("30");
  const [cleanupEnabled, setCleanupEnabled] = useState(true);
  const [encryptBackups, setEncryptBackups] = useState(true);
  const [logLevel, setLogLevel] = useState("info");
  const [maxFileSize, setMaxFileSize] = useState("500");
  const [backupChunkSize, setBackupChunkSize] = useState("100");
  const [adminEmail, setAdminEmail] = useState("admin@example.com");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("");
  
  // Backup content options
  const [backupEverything, setBackupEverything] = useState(false);
  const [includeDatabase, setIncludeDatabase] = useState(true);
  const [includeWordpressCore, setIncludeWordpressCore] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(true);
  const [includeThemes, setIncludeThemes] = useState(true);
  const [includePlugins, setIncludePlugins] = useState(true);
  
  // Handle "Backup Everything" toggle
  const handleBackupEverythingChange = (checked: boolean) => {
    setBackupEverything(checked);
    if (checked) {
      setIncludeDatabase(true);
      setIncludeWordpressCore(true);
      setIncludeMedia(true);
      setIncludeThemes(true);
      setIncludePlugins(true);
    }
  };
  
  // Check if all content options are selected and update "Backup Everything" accordingly
  useEffect(() => {
    if (
      includeDatabase &&
      includeWordpressCore &&
      includeMedia &&
      includeThemes &&
      includePlugins
    ) {
      setBackupEverything(true);
    } else {
      setBackupEverything(false);
    }
  }, [includeDatabase, includeWordpressCore, includeMedia, includeThemes, includePlugins]);
  
  // Handle form submission
  const handleSaveGeneralSettings = () => {
    setSaving(true);
    
    // Gather backup content options data
    const backupContentOptions = {
      backupEverything,
      includeDatabase,
      includeWordpressCore,
      includeMedia,
      includeThemes,
      includePlugins
    };
    
    console.log("Saving backup content options:", backupContentOptions);
    
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      toast({
        title: "Settings saved",
        description: "Your settings have been saved successfully",
      });
    }, 1000);
  };
  
  // Handle password change
  const handlePasswordChange = () => {
    if (!adminPassword) {
      toast({
        title: "Password required",
        description: "Please enter a new password",
        variant: "destructive",
      });
      return;
    }
    
    if (adminPassword !== adminPasswordConfirm) {
      toast({
        title: "Passwords don't match",
        description: "The passwords you entered don't match",
        variant: "destructive",
      });
      return;
    }
    
    setSaving(true);
    
    // Simulate API call
    setTimeout(() => {
      setSaving(false);
      setAdminPassword("");
      setAdminPasswordConfirm("");
      toast({
        title: "Password updated",
        description: "Your password has been updated successfully",
      });
    }, 1000);
  };
  
  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Settings</h1>
          <p className="text-gray-500 dark:text-gray-400">Configure your backup system preferences</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-4">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger 
            value="general" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-100 text-gray-500 dark:text-gray-400"
          >
            General
          </TabsTrigger>
          <TabsTrigger 
            value="backup" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-100 text-gray-500 dark:text-gray-400"
          >
            Backup Settings
          </TabsTrigger>
          <TabsTrigger 
            value="security" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-100 text-gray-500 dark:text-gray-400"
          >
            Security
          </TabsTrigger>
          <TabsTrigger 
            value="advanced" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-100 text-gray-500 dark:text-gray-400"
          >
            Advanced
          </TabsTrigger>
          <TabsTrigger 
            value="account" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-100 text-gray-500 dark:text-gray-400"
          >
            Account
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="general" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Configure basic application settings</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="mr-2 h-5 w-5 text-blue-500" />
                  Application
                </CardTitle>
                <CardDescription>Basic application settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="system-name">System Name</Label>
                  <Input
                    id="system-name"
                    placeholder="BackupSheep Dashboard"
                    defaultValue="BackupSheep Dashboard"
                  />
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="auto-refresh">Auto-refresh Dashboard</Label>
                    <Switch id="auto-refresh" defaultChecked />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Automatically refresh the dashboard every 5 minutes
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-green-500" />
                  Date & Time
                </CardTitle>
                <CardDescription>Time and date preferences</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Default Timezone</Label>
                  <Select defaultValue="UTC">
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UTC">UTC</SelectItem>
                      <SelectItem value="America/New_York">Eastern Time (ET)</SelectItem>
                      <SelectItem value="America/Chicago">Central Time (CT)</SelectItem>
                      <SelectItem value="America/Denver">Mountain Time (MT)</SelectItem>
                      <SelectItem value="America/Los_Angeles">Pacific Time (PT)</SelectItem>
                      <SelectItem value="Europe/London">London (GMT)</SelectItem>
                      <SelectItem value="Europe/Paris">Paris (CET)</SelectItem>
                      <SelectItem value="Asia/Tokyo">Tokyo (JST)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="date-format">Date Format</Label>
                  <Select defaultValue="YYYY-MM-DD">
                    <SelectTrigger id="date-format">
                      <SelectValue placeholder="Select date format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YYYY-MM-DD">YYYY-MM-DD</SelectItem>
                      <SelectItem value="MM/DD/YYYY">MM/DD/YYYY</SelectItem>
                      <SelectItem value="DD/MM/YYYY">DD/MM/YYYY</SelectItem>
                      <SelectItem value="MMM D, YYYY">MMM D, YYYY</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <RefreshCw className="mr-2 h-5 w-5 text-red-500" />
                  System Information
                </CardTitle>
                <CardDescription>System and environment details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">                
                <div className="grid grid-cols-1 gap-3">
                  <div className="flex justify-between items-center border-b pb-1">
                    <p className="text-sm font-medium">Version</p>
                    <p className="text-sm text-muted-foreground">1.0.0</p>
                  </div>
                  <div className="flex justify-between items-center border-b pb-1">
                    <p className="text-sm font-medium">Environment</p>
                    <p className="text-sm text-muted-foreground">Production</p>
                  </div>
                  <div className="flex justify-between items-center border-b pb-1">
                    <p className="text-sm font-medium">Database Status</p>
                    <p className="text-sm text-green-600">Connected</p>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-sm text-muted-foreground">August 15, 2023 14:32</p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="w-full">
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Check for Updates
                </Button>
              </CardFooter>
            </Card>

            <Card className="md:col-span-3">
              <CardFooter className="border-t p-4 mt-2">
                <Button onClick={handleSaveGeneralSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save General Settings
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="backup" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Backup Configuration</CardTitle>
                <CardDescription>Configure how backups are created and stored</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <HardDrive className="mr-2 h-5 w-5 text-blue-500" />
                  Storage Format
                </CardTitle>
                <CardDescription>Configure backup file format</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Compression Type</Label>
                  <RadioGroup 
                    defaultValue={compressionType} 
                    onValueChange={setCompressionType}
                    className="flex flex-col space-y-1"
                  >
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="zip" id="zip" />
                      <Label htmlFor="zip">ZIP (better compatibility)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="tar.gz" id="tar-gz" />
                      <Label htmlFor="tar-gz">TAR.GZ (better compression)</Label>
                    </div>
                    <div className="flex items-center space-x-2">
                      <RadioGroupItem value="none" id="none" />
                      <Label htmlFor="none">No compression</Label>
                    </div>
                  </RadioGroup>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="encrypt" 
                      checked={encryptBackups} 
                      onCheckedChange={(checked) => setEncryptBackups(checked as boolean)} 
                    />
                    <Label htmlFor="encrypt">Encrypt backups</Label>
                  </div>
                  <p className="text-sm text-muted-foreground pl-6">
                    Encrypt backup data for additional security. Requires a password for restoration.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <RefreshCw className="mr-2 h-5 w-5 text-green-500" />
                  Retention Policy
                </CardTitle>
                <CardDescription>Configure backup retention settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="retention">Backup Retention (days)</Label>
                  <Input
                    id="retention"
                    type="number"
                    min="1"
                    value={backupRetention}
                    onChange={(e) => setBackupRetention(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Backups older than this will be automatically deleted
                  </p>
                </div>
                
                <div className="flex items-center space-x-2 mt-4">
                  <Checkbox 
                    id="cleanup" 
                    checked={cleanupEnabled} 
                    onCheckedChange={(checked) => setCleanupEnabled(checked as boolean)} 
                  />
                  <Label htmlFor="cleanup">Enable automatic cleanup of old backups</Label>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="mr-2 h-5 w-5 text-red-500" />
                  Content Selection
                </CardTitle>
                <CardDescription>Choose what to include in backups</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="everything" 
                      checked={backupEverything}
                      onCheckedChange={handleBackupEverythingChange}
                    />
                    <Label htmlFor="everything" className="font-semibold">Backup Everything</Label>
                  </div>
                  <p className="text-sm text-muted-foreground ml-6">
                    Include all WordPress content in backups (recommended)
                  </p>
                </div>
                
                <Separator className="my-2" />
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="database" 
                      checked={includeDatabase}
                      onCheckedChange={(checked) => setIncludeDatabase(checked as boolean)}
                    />
                    <Label htmlFor="database">Include database in backups</Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="wordpress-core" 
                      checked={includeWordpressCore}
                      onCheckedChange={(checked) => setIncludeWordpressCore(checked as boolean)}
                    />
                    <Label htmlFor="wordpress-core">Include WordPress Core in backups</Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="media" 
                      checked={includeMedia}
                      onCheckedChange={(checked) => setIncludeMedia(checked as boolean)}
                    />
                    <Label htmlFor="media">Include media files in backups</Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="themes" 
                      checked={includeThemes}
                      onCheckedChange={(checked) => setIncludeThemes(checked as boolean)}
                    />
                    <Label htmlFor="themes">Include themes in backups</Label>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox 
                      id="plugins" 
                      checked={includePlugins}
                      onCheckedChange={(checked) => setIncludePlugins(checked as boolean)}
                    />
                    <Label htmlFor="plugins">Include plugins in backups</Label>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardFooter className="border-t p-4 mt-2">
                <Button onClick={handleSaveGeneralSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Backup Settings
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="security" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Security Settings</CardTitle>
                <CardDescription>Configure security settings for your backups</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Globe className="mr-2 h-5 w-5 text-blue-500" />
                  API Access
                </CardTitle>
                <CardDescription>Configure API access controls</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <RadioGroup defaultValue="restricted" className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="restricted" id="restricted" />
                    <Label htmlFor="restricted">Restricted (only authenticated users)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="token" id="token" />
                    <Label htmlFor="token">Token-based (API keys)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="open" id="open" />
                    <Label htmlFor="open">Open (not recommended)</Label>
                  </div>
                </RadioGroup>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Clock className="mr-2 h-5 w-5 text-green-500" />
                  Session Settings
                </CardTitle>
                <CardDescription>Configure session timeout</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Session Timeout</Label>
                  <Select defaultValue="30">
                    <SelectTrigger>
                      <SelectValue placeholder="Select timeout period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15 minutes</SelectItem>
                      <SelectItem value="30">30 minutes</SelectItem>
                      <SelectItem value="60">1 hour</SelectItem>
                      <SelectItem value="120">2 hours</SelectItem>
                      <SelectItem value="0">Never (not recommended)</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-sm text-muted-foreground">
                    Automatically log out inactive users after this period
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <ShieldAlert className="mr-2 h-5 w-5 text-red-500" />
                  Access Protection
                </CardTitle>
                <CardDescription>Configure protection features</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="force-ssl">Force SSL</Label>
                    <Switch id="force-ssl" defaultChecked />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Require HTTPS for all connections to the dashboard
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="two-factor">Enable Two-Factor Authentication</Label>
                    <Switch id="two-factor" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Require a second form of authentication when logging in
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="mr-2 h-5 w-5 text-purple-500" />
                  IP Restrictions
                </CardTitle>
                <CardDescription>Control access by IP address</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="allowed-ips">IP Restrictions (one per line)</Label>
                  <Textarea 
                    id="allowed-ips"
                    placeholder="Leave empty to allow all IPs"
                    className="font-mono text-sm"
                  />
                  <p className="text-sm text-muted-foreground">
                    Only allow access from these IP addresses
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveGeneralSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Security Settings
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="advanced" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle>Advanced Settings</CardTitle>
                <CardDescription>Configure advanced settings (use with caution)</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-blue-500" />
                  Logging
                </CardTitle>
                <CardDescription>Configure logging settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="log-level">Log Level</Label>
                  <Select value={logLevel} onValueChange={setLogLevel}>
                    <SelectTrigger id="log-level">
                      <SelectValue placeholder="Select log level" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="debug">Debug (verbose)</SelectItem>
                      <SelectItem value="info">Info (standard)</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="debug-mode">Debug Mode</Label>
                    <Switch id="debug-mode" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Enable additional debugging information
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Database className="mr-2 h-5 w-5 text-green-500" />
                  File Settings
                </CardTitle>
                <CardDescription>Configure file handling</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="max-file-size">Maximum File Size (MB)</Label>
                  <Input
                    id="max-file-size"
                    type="number"
                    min="10"
                    value={maxFileSize}
                    onChange={(e) => setMaxFileSize(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Files larger than this will be excluded from backups
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="chunk-size">Backup Chunk Size (MB)</Label>
                  <Input
                    id="chunk-size"
                    type="number"
                    min="5"
                    value={backupChunkSize}
                    onChange={(e) => setBackupChunkSize(e.target.value)}
                  />
                  <p className="text-sm text-muted-foreground">
                    Size of chunks when processing large backups
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <HardDrive className="mr-2 h-5 w-5 text-red-500" />
                  System Control
                </CardTitle>
                <CardDescription>System control settings</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="maintenance-mode">Maintenance Mode</Label>
                    <Switch id="maintenance-mode" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Put the system in maintenance mode (disables backups)
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="mr-2 h-5 w-5 text-purple-500" />
                  Excluded Paths
                </CardTitle>
                <CardDescription>Configure files and directories to exclude from backups</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="excluded-paths">Excluded Paths (one per line)</Label>
                  <Textarea 
                    id="excluded-paths"
                    placeholder="e.g., wp-content/cache"
                    className="font-mono text-sm"
                    defaultValue="wp-content/cache
wp-content/debug.log
wp-content/uploads/large-files"
                  />
                  <p className="text-sm text-muted-foreground">
                    These paths will be excluded from backups
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button variant="outline" className="text-red-500 mr-2">
                  Reset to Defaults
                </Button>
                <Button onClick={handleSaveGeneralSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Advanced Settings
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="account" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle>Account Settings</CardTitle>
                <CardDescription>Manage your admin account</CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="mr-2 h-5 w-5 text-blue-500" />
                  User Information
                </CardTitle>
                <CardDescription>Update your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email Address</Label>
                  <Input
                    id="admin-email"
                    type="email"
                    value={adminEmail}
                    onChange={(e) => setAdminEmail(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="admin-username">Username</Label>
                  <Input
                    id="admin-username"
                    defaultValue="admin"
                    disabled
                  />
                  <p className="text-sm text-muted-foreground">
                    Username cannot be changed
                  </p>
                </div>
              </CardContent>
              <CardFooter>
                <Button onClick={handleSaveGeneralSettings} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Lock className="mr-2 h-5 w-5 text-red-500" />
                  Password
                </CardTitle>
                <CardDescription>Update your password</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">                
                <div className="space-y-2">
                  <Label htmlFor="admin-current-password">Current Password</Label>
                  <Input
                    id="admin-current-password"
                    type="password"
                    placeholder="Enter current password"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="admin-password">New Password</Label>
                  <Input
                    id="admin-password"
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="admin-password-confirm">Confirm New Password</Label>
                  <Input
                    id="admin-password-confirm"
                    type="password"
                    value={adminPasswordConfirm}
                    onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                  />
                </div>
              </CardContent>
              <CardFooter>
                <Button 
                  onClick={handlePasswordChange} 
                  disabled={saving || !adminPassword || !adminPasswordConfirm}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Updating Password...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Update Password
                    </>
                  )}
                </Button>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SettingsPage;
