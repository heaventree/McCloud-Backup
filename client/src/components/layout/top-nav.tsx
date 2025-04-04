import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Menu, Bell, HelpCircle } from "lucide-react";

interface TopNavProps {
  onMenuClick: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  const [location] = useLocation();

  // Get page title based on current location
  const getPageTitle = () => {
    switch (location) {
      case "/":
        return "Dashboard";
      case "/sites":
        return "Sites";
      case "/backup-schedule":
        return "Backup Schedule";
      case "/storage-providers":
        return "Storage Providers";
      case "/notifications":
        return "Notifications";
      case "/backup-history":
        return "Backup History";
      case "/settings":
        return "Settings";
      default:
        return "Dashboard";
    }
  };

  return (
    <header className="bg-white border-b border-gray-200 h-16 flex items-center justify-between px-4">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden mr-2 text-gray-700"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-medium text-gray-800">{getPageTitle()}</h2>
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="ghost" size="sm" className="relative text-gray-700">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">2</span>
        </Button>
        <Button variant="ghost" size="icon" className="text-gray-700">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default TopNav;
