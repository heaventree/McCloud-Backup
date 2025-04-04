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
      <aside className={`${isOpen ? 'flex' : 'hidden'} md:flex md:flex-col fixed md:static inset-y-0 left-0 w-56 bg-white border-r border-gray-200 z-50`}>
        <div className="flex items-center h-16 px-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <div className="bg-primary rounded-md p-1.5">
              <HardDrive className="h-5 w-5 text-white" />
            </div>
            <h1 className="text-xl font-medium text-primary">BackupSheep</h1>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="md:hidden ml-auto"
            onClick={onClose}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 py-4">
          <ul className="space-y-1">
            {sidebarItems.map((item) => (
              <li key={item.path}>
                <Link href={item.path} 
                  className={`flex items-center px-6 py-2.5 text-gray-700 ${
                    location === item.path 
                      ? 'bg-blue-50 border-l-4 border-primary text-primary font-medium' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {renderIcon(item.icon)}
                  <span className="ml-3">{item.title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <Separator className="my-2" />
        <div className="p-4">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-primary">
              <span className="text-sm font-medium">AD</span>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">Admin User</p>
              <p className="text-xs text-gray-500">admin@example.com</p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
