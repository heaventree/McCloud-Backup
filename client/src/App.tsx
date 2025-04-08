import { Route, Switch, useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import TopNav from "@/components/layout/top-nav";
import Dashboard from "@/pages/dashboard";
import SiteManagement from "@/pages/site-management-simple";
import SiteManagementNew from "@/pages/site-management-new";
import StorageProviders from "@/pages/storage-providers";
import BackupHistory from "@/pages/backup-history";
import Settings from "@/pages/settings";
import Notifications from "@/pages/notifications";
import Plugins from "@/pages/plugins";
import Feedback from "@/pages/feedback";
import NotFound from "@/pages/not-found";
import AuthCallback from "@/pages/auth/callback";
import Login from "@/pages/login";
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import FeedbackWidget from "@/components/feedback/FeedbackWidget";

// Protected Route Component
function ProtectedRoute({ component: Component, ...rest }: { component: React.ComponentType<any>, path?: string }) {
  const { data: authData, isLoading } = useQuery({ 
    queryKey: ['auth-status'],
    queryFn: async () => {
      const response = await fetch('/api/status');
      if (!response.ok) {
        throw new Error('Failed to fetch auth status');
      }
      return response.json();
    },
    refetchOnWindowFocus: true,  // Update when window gains focus
    refetchInterval: 30000       // Check auth status every 30 seconds
  });
  
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && !authData?.authenticated) {
      navigate('/login');
    }
  }, [authData, isLoading, navigate]);

  if (isLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  if (!authData?.authenticated) {
    return null;
  }

  return <Component {...rest} />;
}

function App() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  
  // We'll use the useDarkMode hook to handle theme toggling instead of forcing dark mode
  // The theme will be initialized by the useDarkMode hook based on localStorage or system preference

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // Check if current path is login page
  const isLoginPage = location === '/login';

  // Determine if the current route is an auth callback route
  const isAuthCallbackRoute = () => {
    const path = window.location.pathname;
    return (
      path.startsWith('/auth/google/callback') ||
      path.startsWith('/auth/dropbox/callback') ||
      path.startsWith('/auth/onedrive/callback')
    );
  };

  // For OAuth callback pages, don't show the sidebar and header
  if (isAuthCallbackRoute()) {
    return (
      <Switch>
        <Route path="/auth/:provider/callback" component={AuthCallback} />
      </Switch>
    );
  }

  // For login page, show only the login component
  if (isLoginPage) {
    return (
      <Switch>
        <Route path="/login" component={Login} />
      </Switch>
    );
  }

  return (
    <div className="main-wrapper">
      <Sidebar isOpen={isMobileMenuOpen} onClose={() => setIsMobileMenuOpen(false)} />

      <div className="page-wrapper">
        <TopNav onMenuClick={toggleMobileMenu} />

        <div className="page-content bg-gray-50 dark:bg-gray-900">
          <Switch>
            <Route path="/">
              <ProtectedRoute component={Dashboard} />
            </Route>
            <Route path="/dashboard">
              <ProtectedRoute component={Dashboard} />
            </Route>
            <Route path="/sites">
              <ProtectedRoute component={SiteManagement} />
            </Route>
            <Route path="/storage-providers">
              <ProtectedRoute component={StorageProviders} />
            </Route>
            <Route path="/backup-history">
              <ProtectedRoute component={BackupHistory} />
            </Route>
            <Route path="/notifications">
              <ProtectedRoute component={Notifications} />
            </Route>
            <Route path="/settings">
              <ProtectedRoute component={Settings} />
            </Route>
            <Route path="/plugins">
              <ProtectedRoute component={Plugins} />
            </Route>
            <Route path="/feedback">
              <ProtectedRoute component={Feedback} />
            </Route>
            <Route path="/login" component={Login} />
            <Route path="/auth/:provider/callback" component={AuthCallback} />
            <Route component={NotFound} />
          </Switch>
        </div>
      </div>
      
      {/* Add Feedback Widget to all pages (except login/auth pages) */}
      {!isLoginPage && !isAuthCallbackRoute() && (
        <FeedbackWidget projectId="default" />
      )}
    </div>
  );
}

export default App;
