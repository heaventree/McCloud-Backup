import React, { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { Loader2, Bell, Mail, MessageSquare, Smartphone, Trash, BellOff, CheckCircle, XCircle, AlertCircle, Info } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const NotificationsPage = () => {
  // For now, using hardcoded user ID - in a real app this would come from auth context
  const userId = 1;
  const { toast } = useToast();
  
  // State for form inputs
  const [emailEnabled, setEmailEnabled] = useState(false);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [phoneInput, setPhoneInput] = useState("");
  const [emailBackupCompleted, setEmailBackupCompleted] = useState(true);
  const [emailBackupFailed, setEmailBackupFailed] = useState(true);
  const [emailStorageWarning, setEmailStorageWarning] = useState(true);
  const [smsBackupFailed, setSmsBackupFailed] = useState(true);
  const [smsCriticalStorageWarning, setSmsCriticalStorageWarning] = useState(true);
  
  // Fetch notifications from API
  const {
    data: notificationsData,
    isLoading: notificationsLoading,
    refetch: refetchNotifications,
  } = useQuery({
    queryKey: ['/api/notifications'],
  });
  
  const notifications = (notificationsData as any)?.notifications || [];

  // Fetch notification preferences
  const {
    data: notificationPreferences,
    isLoading: preferencesLoading,
    refetch: refetchPreferences,
  } = useQuery({
    queryKey: ['/api/notification-preferences', userId],
    enabled: !!userId,
  });

  const preferences = notificationPreferences as any;

  // Update form state when preferences are loaded
  React.useEffect(() => {
    if (preferences) {
      setEmailEnabled(preferences.emailEnabled || false);
      setSmsEnabled(preferences.smsEnabled || false);
      setEmailInput(preferences.emailAddress || "");
      setPhoneInput(preferences.smsPhoneNumber || "");
      setEmailBackupCompleted(preferences.emailBackupCompleted);
      setEmailBackupFailed(preferences.emailBackupFailed);
      setEmailStorageWarning(preferences.emailStorageWarning);
      setSmsBackupFailed(preferences.smsBackupFailed);
      setSmsCriticalStorageWarning(preferences.smsCriticalStorageWarning);
    }
  }, [preferences]);

  // Mutation for saving notification preferences
  const savePreferencesMutation = useMutation({
    mutationFn: async (preferencesData: any) => {
      if (notificationPreferences) {
        // Update existing preferences
        return await apiRequest('PUT', `/api/notification-preferences/${userId}`, preferencesData);
      } else {
        // Create new preferences
        return await apiRequest('POST', '/api/notification-preferences', { ...preferencesData, userId });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notification-preferences', userId] });
      toast({
        title: 'Settings saved',
        description: 'Your notification preferences have been updated',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save notification preferences',
        variant: 'destructive',
      });
    },
  });
  
  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await apiRequest('PUT', `/api/notifications/${notificationId}/read`);
      return notificationId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: 'Notification marked as read',
        description: 'The notification has been marked as read',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark notification as read',
        variant: 'destructive',
      });
    },
  });
  
  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('PUT', '/api/notifications/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: 'All notifications marked as read',
        description: 'All notifications have been marked as read',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to mark all notifications as read',
        variant: 'destructive',
      });
    },
  });
  
  // Clear all notifications mutation
  const clearAllMutation = useMutation({
    mutationFn: async () => {
      await apiRequest('DELETE', '/api/notifications');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/notifications'] });
      toast({
        title: 'All notifications cleared',
        description: 'All notifications have been deleted',
      });
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to clear all notifications',
        variant: 'destructive',
      });
    },
  });

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case "error":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "warning":
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-500" />;
      default:
        return <Bell className="h-5 w-5 text-gray-500" />;
    }
  };

  // Format date to relative time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffInHours < 48) {
      return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
             `, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
  };
  
  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };
  
  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate();
  };
  
  const handleClearAll = () => {
    clearAllMutation.mutate();
  };

  // Form handlers for notification preferences
  const handleSaveEmailSettings = () => {
    savePreferencesMutation.mutate({
      emailEnabled,
      emailAddress: emailEnabled && emailInput ? emailInput : undefined,
      emailBackupCompleted,
      emailBackupFailed,
      emailStorageWarning,
    });
  };

  const handleSaveSmsSettings = () => {
    savePreferencesMutation.mutate({
      smsEnabled,
      smsPhoneNumber: smsEnabled && phoneInput ? phoneInput : undefined,
      smsBackupFailed,
      smsCriticalStorageWarning,
    });
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-800 dark:text-gray-100">Notifications</h1>
          <p className="text-gray-500 dark:text-gray-400">Configure and view system notifications</p>
        </div>
      </div>

      <Tabs defaultValue="notification-center" className="space-y-4">
        <TabsList className="bg-gray-100 dark:bg-gray-800">
          <TabsTrigger 
            value="notification-center" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-100 text-gray-500 dark:text-gray-400"
          >
            Notification Center
          </TabsTrigger>
          <TabsTrigger 
            value="settings" 
            className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:text-gray-800 dark:data-[state=active]:text-gray-100 text-gray-500 dark:text-gray-400"
          >
            Notification Settings
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="notification-center" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100">Recent Notifications</h2>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleMarkAllAsRead}
                disabled={markAllAsReadMutation.isPending}
              >
                {markAllAsReadMutation.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                Mark All as Read
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                className="text-red-600 dark:text-red-400 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700"
                onClick={handleClearAll}
                disabled={clearAllMutation.isPending}
              >
                {clearAllMutation.isPending ? (
                  <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                ) : (
                  <Trash className="h-4 w-4 mr-1" />
                )}
                Clear All
              </Button>
            </div>
          </div>
          
          {notificationsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
            </div>
          ) : notifications.length === 0 ? (
            <Card className="bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BellOff className="h-10 w-10 text-gray-400 mb-4" />
                <p className="text-gray-500 dark:text-gray-400">No notifications to display</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification: any) => (
                <Card key={notification.id} className={`bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 ${notification.read ? "opacity-80" : ""}`}>
                  <CardHeader className="py-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification.type)}
                        <div>
                          <CardTitle className="text-base text-gray-800 dark:text-gray-100">{notification.title}</CardTitle>
                          <CardDescription className="text-gray-500 dark:text-gray-400">{notification.message}</CardDescription>
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDate(notification.createdAt)}
                      </div>
                    </div>
                  </CardHeader>
                  {!notification.read && (
                    <CardFooter className="pt-0 pb-3">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                        onClick={() => handleMarkAsRead(notification.id)}
                        disabled={markAsReadMutation.isPending}
                      >
                        {markAsReadMutation.isPending && markAsReadMutation.variables === notification.id && (
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        )}
                        Mark as Read
                      </Button>
                    </CardFooter>
                  )}
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Email Notifications</CardTitle>
              <CardDescription>Receive backup status updates via email</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Email Notifications</Label>
                </div>
                <Switch 
                  checked={emailEnabled} 
                  onCheckedChange={setEmailEnabled}
                  disabled={preferencesLoading || savePreferencesMutation.isPending} 
                />
              </div>
              
              {emailEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                  />
                </div>
              )}
              
              <div className="pt-2">
                <Label className="mb-2 block">Notification Events</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Backup completed</span>
                    <Switch 
                      checked={emailBackupCompleted} 
                      onCheckedChange={setEmailBackupCompleted}
                      disabled={preferencesLoading || savePreferencesMutation.isPending}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Backup failed</span>
                    <Switch 
                      checked={emailBackupFailed} 
                      onCheckedChange={setEmailBackupFailed}
                      disabled={preferencesLoading || savePreferencesMutation.isPending}
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Storage space warning</span>
                    <Switch 
                      checked={emailStorageWarning} 
                      onCheckedChange={setEmailStorageWarning}
                      disabled={preferencesLoading || savePreferencesMutation.isPending}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveEmailSettings}
                disabled={preferencesLoading || savePreferencesMutation.isPending}
              >
                {savePreferencesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save Email Settings
              </Button>
            </CardFooter>
          </Card>
          
          <Card>
            <CardHeader>
              <CardTitle>SMS Notifications</CardTitle>
              <CardDescription>Receive critical alerts via SMS</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable SMS Notifications</Label>
                </div>
                <Switch 
                  checked={smsEnabled} 
                  onCheckedChange={setSmsEnabled}
                  disabled={preferencesLoading || savePreferencesMutation.isPending} 
                />
              </div>
              
              {smsEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Standard SMS rates may apply based on your carrier
                  </p>
                </div>
              )}
              
              {smsEnabled && (
                <div className="pt-2">
                  <Label className="mb-2 block">SMS Notification Events</Label>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Backup failed</span>
                      <Switch 
                        checked={smsBackupFailed} 
                        onCheckedChange={setSmsBackupFailed}
                        disabled={preferencesLoading || savePreferencesMutation.isPending}
                      />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Critical storage warnings</span>
                      <Switch 
                        checked={smsCriticalStorageWarning} 
                        onCheckedChange={setSmsCriticalStorageWarning}
                        disabled={preferencesLoading || savePreferencesMutation.isPending}
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button 
                onClick={handleSaveSmsSettings}
                disabled={preferencesLoading || savePreferencesMutation.isPending}
              >
                {savePreferencesMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Save SMS Settings
              </Button>
            </CardFooter>
          </Card>
          
{/* Slack Integration - Commented out for now
          <Card>
            <CardHeader>
              <CardTitle>Slack Integration</CardTitle>
              <CardDescription>Send notifications to your Slack channels</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Enable Slack Notifications</Label>
                </div>
                <Switch checked={slackEnabled} onCheckedChange={setSlackEnabled} />
              </div>
              
              {slackEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="webhook">Slack Webhook URL</Label>
                  <Input
                    id="webhook"
                    type="text"
                    placeholder="https://hooks.slack.com/services/..."
                    value={slackInput}
                    onChange={(e) => setSlackInput(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Create a webhook URL in your Slack workspace settings
                  </p>
                </div>
              )}
              
              {slackEnabled && (
                <div className="pt-2">
                  <Label className="mb-2 block">Channel Settings</Label>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="channel" className="text-sm">Channel</Label>
                        <Select defaultValue="#backups">
                          <SelectTrigger>
                            <SelectValue placeholder="Select channel" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="#backups">#backups</SelectItem>
                            <SelectItem value="#general">#general</SelectItem>
                            <SelectItem value="#alerts">#alerts</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="mentions" className="text-sm">Mention</Label>
                        <Select defaultValue="none">
                          <SelectTrigger>
                            <SelectValue placeholder="Select mentions" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="none">No mentions</SelectItem>
                            <SelectItem value="here">@here</SelectItem>
                            <SelectItem value="channel">@channel</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button disabled={!slackEnabled}>Save Slack Settings</Button>
            </CardFooter>
          </Card>
        */}
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationsPage;
