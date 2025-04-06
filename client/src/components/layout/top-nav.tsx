import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { Menu, Bell, HelpCircle, Search, User, Settings, Sun, Moon } from "lucide-react";
import { useDarkMode } from "@/hooks/use-dark-mode";

interface TopNavProps {
  onMenuClick: () => void;
}

const TopNav = ({ onMenuClick }: TopNavProps) => {
  const [location] = useLocation();
  const { theme, toggleTheme } = useDarkMode();

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
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 py-3 h-[70px] flex items-center justify-between px-6 sticky top-0 z-30">
      <div className="flex items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="lg:hidden mr-3 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={onMenuClick}
        >
          <Menu className="h-6 w-6" />
        </Button>
        <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 hidden md:block">{getPageTitle()}</h2>
      </div>
      
      <div className="flex-1 max-w-xl mx-auto px-4 hidden md:block">
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
      </div>
      
      <div className="flex items-center space-x-4">
        <Button 
          variant="ghost" 
          size="sm" 
          className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
          onClick={toggleTheme}
          aria-label="Toggle dark mode"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        
        <Button variant="ghost" size="sm" className="relative p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
          <Bell className="h-5 w-5" />
          <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 dark:bg-red-400 rounded-full"></span>
        </Button>
        
        <div className="relative inline-block">
          <Button variant="ghost" className="flex items-center space-x-2 p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
            <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <User className="h-4 w-4" />
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Admin User</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">Administrator</p>
            </div>
          </Button>
        </div>
        
        <Button variant="ghost" size="sm" className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
          <Settings className="h-5 w-5" />
        </Button>
      </div>
    </header>
  );
};

export default TopNav;
