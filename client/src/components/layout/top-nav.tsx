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
    <header className="bg-white border-b border-neutral-300 h-16 flex items-center justify-between px-4 shadow-sm">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="md:hidden mr-2 text-neutral-700"
          onClick={onMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h2 className="text-xl font-medium text-neutral-800">{getPageTitle()}</h2>
      </div>
      <div className="flex items-center space-x-3">
        <Button variant="ghost" size="icon" className="rounded-full">
          <Bell className="h-5 w-5 text-neutral-700" />
        </Button>
        <Button variant="ghost" size="icon" className="rounded-full">
          <HelpCircle className="h-5 w-5 text-neutral-700" />
        </Button>
      </div>
    </header>
  );
};

export default TopNav;
