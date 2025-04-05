import { Route, Switch } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import TopNav from "@/components/layout/top-nav";
import Dashboard from "@/pages/dashboard";
import SiteManagement from "@/pages/site-management";
import StorageProviders from "@/pages/storage-providers";
import BackupHistory from "@/pages/backup-history";
import Settings from "@/pages/settings";
import Notifications from "@/pages/notifications";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Initialize dark mode on first render based on theme.json
  useEffect(() => {
    // Force dark mode based on theme.json
    document.documentElement.classList.add('dark');
    localStorage.setItem('theme', 'dark');
  }, []);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="main-wrapper">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="page-wrapper">
        <TopNav onMenuClick={toggleMobileMenu} />

        <div className="page-content bg-gray-50 dark:bg-gray-900">
          <Switch>
            <Route path="/" component={Dashboard} />
            <Route path="/sites" component={SiteManagement} />
            <Route path="/storage-providers" component={StorageProviders} />
            <Route path="/backup-history" component={BackupHistory} />
            <Route path="/notifications" component={Notifications} />
            <Route path="/settings" component={Settings} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>
    </div>
  );
}

export default App;
