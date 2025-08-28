import { Button } from '@/components/ui/button';
import { useLocation } from 'wouter';
import {
  Menu,
  Bell,
  HelpCircle,
  Search,
  User,
  Settings,
  Sun,
  Moon,
  LogOut,
  CheckCircle,
  XCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import { useDarkMode } from '@/hooks/use-dark-mode';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { secureFetch } from '@/lib/csrf';
import { apiRequest } from '@/lib/queryClient';

interface TopNavProps {
  onMenuClick: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  const [location, navigate] = useLocation();
  const { theme, toggleTheme } = useDarkMode();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch auth status
  const { data: authData } = useQuery({
    queryKey: ['auth-status'],
    queryFn: async () => {
      try {
        const response = await fetch('/api/status');
        if (!response.ok) {
          return { authenticated: false };
        }
        return response.json();
      } catch (error) {
        return { authenticated: false };
      }
    },
    refetchOnWindowFocus: false,
  });

  // Fetch latest 5 notifications
  const { data: notificationsData, refetch: refetchNotifications } = useQuery({
    queryKey: ['/api/notifications'],
    enabled: !!authData?.authenticated,
  });

  const notifications = (notificationsData as any)?.notifications || [];
  const latestNotifications = notifications.slice(0, 5);
  const hasUnreadNotifications = notifications.some((notification: any) => !notification.read);

  // Mark notification as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: async (notificationId: number) => {
      await apiRequest('PUT', `/api/notifications/${notificationId}/read`);
      return notificationId;
    },
    onSuccess: () => {
      refetchNotifications();
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

  // Get notification icon based on type
  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'success':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'error':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'info':
        return <Info className="h-4 w-4 text-blue-500" />;
      default:
        return <Bell className="h-4 w-4 text-gray-500" />;
    }
  };

  // Format date to relative time
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = diffInMs / (1000 * 60 * 60);

    if (diffInHours < 1) {
      return 'Just now';
    } else if (diffInHours < 24) {
      return `${Math.floor(diffInHours)}h ago`;
    } else if (diffInHours < 48) {
      return 'Yesterday';
    } else {
      return `${Math.floor(diffInHours / 24)}d ago`;
    }
  };

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate(notificationId);
  };

  const handleLogout = async () => {
    try {
      const response = await secureFetch('/api/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.ok) {
        // Invalidate auth status query
        queryClient.invalidateQueries({ queryKey: ['auth-status'] });
        toast({
          title: 'Logged out',
          description: 'You have been successfully logged out',
        });

        // Force page reload to update auth state and redirect
        setTimeout(() => {
          window.location.href = '/login';
        }, 500);
      } else {
        toast({
          variant: 'destructive',
          title: 'Logout Error',
          description: 'Failed to logout. Please try again.',
        });
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Logout Error',
        description: 'An error occurred during logout. Please try again.',
      });
    }
  };

  // Get page title based on current location
  const getPageTitle = () => {
    switch (location) {
      case '/':
        return 'Dashboard';
      case '/sites':
        return 'Sites';
      case '/backup-schedule':
        return 'Backup Schedule';
      case '/storage-providers':
        return 'Storage Providers';
      case '/notifications':
        return 'Notifications';
      case '/backup-history':
        return 'Backup History';
      case '/settings':
        return 'Settings';
      default:
        return 'Dashboard';
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-[72px] items-center justify-between border-b border-gray-200 bg-white px-6 py-3 dark:border-gray-700 dark:bg-gray-800">
      <div className="flex items-center">
        <Button
          variant="ghost"
          size="icon"
          className="mr-3 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300 lg:hidden"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
        </Button>
        <h2 className="hidden text-lg font-medium text-gray-800 dark:text-gray-100 md:block">
          {getPageTitle()}
        </h2>
      </div>

      {/* <div className="flex-1 max-w-xl mx-auto px-4 hidden md:block">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
            <Search className="h-4 w-4 text-gray-400 dark:text-gray-500" />
          </div>
          <input 
            type="search" 
            className="block w-full py-2 pl-10 pr-3 text-sm rounded-lg border focus:ring-0 focus:outline-none bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-700 dark:text-gray-200 focus:border-blue-500 dark:focus:border-blue-500" 
            placeholder="Search..." 
          />
        </div>
      </div> */}

      <div className="flex items-center space-x-4">
        <Button
          variant="ghost"
          size="sm"
          className="relative p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="relative p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <Bell className="h-5 w-5" />
              {hasUnreadNotifications && (
                <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 dark:bg-red-400"></span>
              )}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="max-h-96 w-80 overflow-y-auto border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800"
          >
            <div className="border-b border-gray-200 px-3 py-2 dark:border-gray-600">
              <h3 className="font-medium text-gray-900 dark:text-gray-100">Notifications</h3>
            </div>
            {latestNotifications.length === 0 ? (
              <div className="px-3 py-4 text-center text-gray-500 dark:text-gray-400">
                No notifications
              </div>
            ) : (
              <>
                {latestNotifications.map((notification: any) => (
                  <div
                    key={notification.id}
                    className={`border-b border-gray-100 px-3 py-3 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700/50 ${
                      notification.read ? 'opacity-80' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between space-x-2">
                      <div className="flex min-w-0 flex-1 items-start space-x-2">
                        {getNotificationIcon(notification.type)}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                            {notification.title}
                          </p>
                          <p className="line-clamp-2 text-xs text-gray-600 dark:text-gray-300">
                            {notification.message}
                          </p>
                          <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            {formatDate(notification.createdAt)}
                          </p>
                        </div>
                      </div>
                      {!notification.read && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-auto px-2 py-1 text-xs text-blue-600 hover:bg-blue-50 hover:text-blue-700 dark:text-blue-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-300"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(notification.id);
                          }}
                          disabled={markAsReadMutation.isPending}
                        >
                          Mark Read
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
                <DropdownMenuItem
                  className="cursor-pointer px-3 py-2 text-center text-blue-600 hover:bg-blue-50 hover:text-blue-700 focus:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/20 dark:hover:text-blue-300 dark:focus:bg-blue-900/20"
                  onClick={() => navigate('/notifications')}
                >
                  View More
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center space-x-2 p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
                <User className="h-4 w-4" />
              </div>
              <div className="hidden text-left md:block">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-200">
                  {authData?.user?.username || 'Admin User'}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {authData?.user?.role || 'Administrator'}
                </p>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onClick={() => navigate('/settings')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Settings</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleLogout}>
              <LogOut className="mr-2 h-4 w-4" />
              <span>Logout</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* <Button
          variant="ghost"
          size="sm"
          className="p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-gray-300"
        >
          <Settings className="h-5 w-5" />
        </Button> */}
      </div>
    </header>
  );
};

export default TopNav;
