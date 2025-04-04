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
import { useState } from "react";

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <div className="flex h-screen overflow-hidden bg-white">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden">
        <TopNav onMenuClick={toggleMobileMenu} />

        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50">
          <div className="max-w-7xl mx-auto">
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
        </main>
      </div>
    </div>
  );
}

export default App;
