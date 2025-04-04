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
    <header className="bg-white/80 backdrop-blur-md border-b border-neutral-200 h-16 flex items-center justify-between px-5 shadow-sm">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden mr-3 text-gray-700 hover:bg-gray-100 transition-colors"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-semibold text-gray-800 tracking-tight">{getPageTitle()}</h2>
        
        {/* Breadcrumb indicator */}
        {location !== "/" && (
          <div className="hidden md:flex items-center ml-4 text-sm text-gray-500">
            <span className="mx-2">›</span>
            <span>Overview</span>
          </div>
        )}
      </div>
      <div className="flex items-center space-x-2">
        <Button variant="outline" size="sm" className="h-9 rounded-full border-gray-200 text-gray-700 hover:bg-gray-100 hover:text-primary transition-colors">
          <Bell className="h-4 w-4 mr-1" />
          <span className="hidden md:inline text-sm">Notifications</span>
        </Button>
        <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full hover:bg-gray-100 transition-colors">
          <HelpCircle className="h-5 w-5 text-gray-700" />
        </Button>
      </div>
    </header>
  );
};

export default TopNav;
