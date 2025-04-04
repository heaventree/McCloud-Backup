import { Route, Switch } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import TopNav from "@/components/layout/top-nav";
import Dashboard from "@/pages/dashboard";
import Sites from "@/pages/sites";
import BackupSchedule from "@/pages/backup-schedule";
import StorageProviders from "@/pages/storage-providers";
import BackupHistory from "@/pages/backup-history";
import Settings from "@/pages/settings";
import Notifications from "@/pages/notifications";
import NotFound from "@/pages/not-found";
import { useState, useEffect } from "react";

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Initialize dark mode on first render
  useEffect(() => {
    // Check if theme preference is stored in localStorage
    const savedTheme = localStorage.getItem('theme');
    const prefersDark = window.matchMedia && 
      window.matchMedia('(prefers-color-scheme: dark)').matches;
    
    // Set dark class on html element if needed
    if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {
      document.documentElement.classList.add('dark');
    }
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
            <Route path="/sites" component={Sites} />
            <Route path="/backup-schedule" component={BackupSchedule} />
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
