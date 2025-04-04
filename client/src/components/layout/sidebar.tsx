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
  X 
} from "lucide-react";

const sidebarItems: SidebarItem[] = [
  { title: "Dashboard", icon: "LayoutDashboard", path: "/" },
  { title: "Sites", icon: "Globe", path: "/sites" },
  { title: "Backup Schedule", icon: "Clock", path: "/backup-schedule" },
  { title: "Storage Providers", icon: "HardDrive", path: "/storage-providers" },
  { title: "Notifications", icon: "Bell", path: "/notifications" },
  { title: "Backup History", icon: "History", path: "/backup-history" },
  { title: "Settings", icon: "Settings", path: "/settings" },
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
    return IconComponent ? <IconComponent className="mr-3 h-5 w-5" /> : null;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside className={`${isOpen ? 'flex' : 'hidden'} md:flex md:flex-col fixed md:static inset-y-0 left-0 w-64 bg-white/90 backdrop-blur-md border-r border-neutral-200 shadow-lg z-50 transition-all duration-300`}>
        <div className="flex items-center justify-between h-16 border-b border-neutral-200 px-5">
          <div className="flex items-center space-x-3">
            <div className="bg-primary p-1.5 rounded-lg shadow-md">
              <HardDrive className="h-6 w-6 text-white" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-indigo-400">BackupSheep</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden hover:bg-gray-100 transition-colors"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          <ul className="px-2 space-y-1">
            {sidebarItems.map((item) => (
              <li key={item.path}>
                <Link href={item.path} 
                  className={`flex items-center px-3 py-2.5 rounded-lg text-gray-700 transition-all duration-200 ${
                    location === item.path 
                      ? 'bg-primary/10 text-primary font-medium shadow-sm' 
                      : 'hover:bg-gray-100 hover:text-primary'
                  }`}
                >
                  {renderIcon(item.icon)}
                  <span>{item.title}</span>
                  {location === item.path && (
                    <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary"></div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Separator className="my-2 mx-4 opacity-70" />
        <div className="p-4 mb-2">
          <div className="flex items-center space-x-3 p-2 rounded-lg hover:bg-gray-100 transition-colors">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-indigo-500 flex items-center justify-center text-white shadow-md">
              <span className="text-sm font-bold">AD</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Admin User</p>
              <p className="text-xs text-gray-500">admin@example.com</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
