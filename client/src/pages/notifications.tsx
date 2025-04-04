import { useState } from "react";
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

const NotificationsPage = () => {
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [smsEnabled, setSmsEnabled] = useState(false);
  const [slackEnabled, setSlackEnabled] = useState(true);
  const [emailInput, setEmailInput] = useState("admin@example.com");
  const [phoneInput, setPhoneInput] = useState("");
  const [slackInput, setSlackInput] = useState("https://hooks.slack.com/services/TXXXXXXXX/BXXXXXXXX/XXXXXXXXXXXXXXXXXXXXXXXX");
  
  // Mock notification data (this would come from API in real app)
  const notifications = [
    {
      id: 1,
      title: "Backup Completed",
      message: "Main Website was backed up successfully",
      type: "success",
      date: "2023-08-15T14:32:00Z",
      read: true
    },
    {
      id: 2,
      title: "Backup Failed",
      message: "Blog backup failed: Connection error",
      type: "error",
      date: "2023-08-15T13:45:00Z",
      read: false
    },
    {
      id: 3,
      title: "Storage Warning",
      message: "Google Drive storage at 85% capacity",
      type: "warning",
      date: "2023-08-14T10:22:00Z",
      read: false
    },
    {
      id: 4,
      title: "New Site Added",
      message: "Forum site was added successfully",
      type: "info",
      date: "2023-08-13T09:15:00Z",
      read: true
    },
    {
      id: 5,
      title: "Backup Schedule Updated",
      message: "Shop backup schedule changed to daily at 03:00",
      type: "info",
      date: "2023-08-12T16:40:00Z",
      read: true
    }
  ];

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

  return (
    <div>
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notifications</h1>
          <p className="text-muted-foreground">Configure and view system notifications</p>
        </div>
      </div>

      <Tabs defaultValue="notification-center" className="space-y-4">
        <TabsList>
          <TabsTrigger value="notification-center">Notification Center</TabsTrigger>
          <TabsTrigger value="settings">Notification Settings</TabsTrigger>
        </TabsList>
        
        <TabsContent value="notification-center" className="space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-medium">Recent Notifications</h2>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm">
                Mark All as Read
              </Button>
              <Button variant="outline" size="sm" className="text-red-500">
                <Trash className="h-4 w-4 mr-1" />
                Clear All
              </Button>
            </div>
          </div>
          
          {notifications.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <BellOff className="h-10 w-10 text-gray-400 mb-4" />
                <p className="text-muted-foreground">No notifications to display</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {notifications.map((notification) => (
                <Card key={notification.id} className={notification.read ? "opacity-80" : ""}>
                  <CardHeader className="py-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-start gap-3">
                        {getNotificationIcon(notification.type)}
                        <div>
                          <CardTitle className="text-base">{notification.title}</CardTitle>
                          <CardDescription>{notification.message}</CardDescription>
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(notification.date)}
                      </div>
                    </div>
                  </CardHeader>
                  {!notification.read && (
                    <CardFooter className="pt-0 pb-3">
                      <Button variant="ghost" size="sm">Mark as Read</Button>
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
                <Switch checked={emailEnabled} onCheckedChange={setEmailEnabled} />
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
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Backup failed</span>
                    <Switch checked={true} />
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Storage space warning</span>
                    <Switch checked={true} />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button>Save Email Settings</Button>
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
                <Switch checked={smsEnabled} onCheckedChange={setSmsEnabled} />
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
                      <Switch checked={true} />
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Critical storage warnings</span>
                      <Switch checked={true} />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
            <CardFooter>
              <Button disabled={!smsEnabled}>Save SMS Settings</Button>
            </CardFooter>
          </Card>
          
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
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default NotificationsPage;
