import { Link, useLocation } from "wouter";
import { SidebarItem } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { 
  LayoutDashboard, 
  Globe, 
  Clock, 
  HardDrive, 
  Bell, 
  History, 
  Settings,
  X,
  ChevronDown,
  Home,
  Download,
  Shield
} from "lucide-react";

const sidebarItems: SidebarItem[] = [
  { title: "Dashboard", icon: "LayoutDashboard", path: "/" },
  { title: "Site Management", icon: "Globe", path: "/sites" },
  { title: "Storage Providers", icon: "HardDrive", path: "/storage-providers" },
  { title: "Notifications", icon: "Bell", path: "/notifications" },
  { title: "Backup History", icon: "History", path: "/backup-history" },
  { title: "Settings", icon: "Settings", path: "/settings" },
  { title: "Plugins", icon: "Download", path: "/plugins" },
];

// Map icon strings to Lucide icon components
const iconMap = {
  LayoutDashboard,
  Globe,
  Clock,
  HardDrive,
  Bell,
  History,
  Settings,
  Download,
};

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

const Sidebar = ({ isOpen, onClose }: SidebarProps) => {
  const [location] = useLocation();

  // Helper to render the appropriate icon component
  const renderIcon = (iconName: string) => {
    const IconComponent = iconMap[iconName as keyof typeof iconMap];
    return IconComponent ? <IconComponent className="h-5 w-5" /> : null;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`${isOpen ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 fixed lg:static inset-y-0 left-0 w-[240px] bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 z-50 transition-transform duration-300 ease-in-out shadow-sm flex flex-col`}>
        {/* Logo area */}
        <div className="h-[70px] px-5 flex items-center border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <div className="flex items-center space-x-2.5">
            <div className="bg-blue-600 rounded-lg p-2 flex-shrink-0">
              <Shield className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white tracking-tight">BackupSheep</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="lg:hidden ml-auto text-gray-500 dark:text-gray-400"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Main navigation */}
        <div className="flex-1 overflow-y-auto py-5 px-4">
          <div className="mb-4">
            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400 px-3 mb-2">Main</p>
            <ul className="space-y-1.5">
              {sidebarItems.slice(0, 1).map((item) => (
                <li key={item.path}>
                  <Link href={item.path} 
                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm ${
                      location === item.path 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7">
                      {renderIcon(item.icon)}
                    </span>
                    <span className="ml-2">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-4">
            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400 px-3 mb-2">Management</p>
            <ul className="space-y-1.5">
              {sidebarItems.slice(1, 6).map((item) => (
                <li key={item.path}>
                  <Link href={item.path} 
                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm ${
                      location === item.path 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7">
                      {renderIcon(item.icon)}
                    </span>
                    <span className="ml-2">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="mb-4">
            <p className="text-xs uppercase font-medium text-gray-500 dark:text-gray-400 px-3 mb-2">Integrations</p>
            <ul className="space-y-1.5">
              {sidebarItems.slice(6).map((item) => (
                <li key={item.path}>
                  <Link href={item.path} 
                    className={`flex items-center px-3 py-2.5 rounded-lg text-sm ${
                      location === item.path 
                        ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium' 
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700/30'
                    }`}
                  >
                    <span className="inline-flex items-center justify-center w-7 h-7">
                      {renderIcon(item.icon)}
                    </span>
                    <span className="ml-2">{item.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* User profile area */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 flex-shrink-0">
              <span className="text-sm font-medium">AD</span>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate">Admin User</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">admin@example.com</p>
            </div>
            <Button variant="ghost" size="icon" className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
