import { useEffect } from "react";
import { useLocation } from "wouter";

type ProviderType = 'google' | 'dropbox' | 'onedrive';

/**
 * This page is the OAuth callback that receives the authorization code from providers.
 * It sends the code back to the opener window and closes itself.
 */
export default function Callback() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    try {
      // Get the URL parameters
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const error = params.get('error');
      
      // Get the provider from the URL path
      const pathSegments = window.location.pathname.split('/');
      const providerPath = pathSegments[pathSegments.length - 2];
      
      // Map the path to the provider type
      const providers: Record<string, ProviderType> = {
        'google': 'google',
        'dropbox': 'dropbox',
        'onedrive': 'onedrive',
      };
      
      const provider = providers[providerPath] || 'google';
      
      // Send the data back to the opener window
      if (window.opener) {
        window.opener.postMessage({
          type: 'oauth-callback',
          provider: `${provider}_drive`,
          code,
          error,
        }, window.location.origin);
        
        // Close this window after a brief delay
        setTimeout(() => {
          window.close();
        }, 300);
      } else {
        // If no opener, redirect to the dashboard
        setLocation('/');
      }
    } catch (error) {
      console.error('Error in OAuth callback:', error);
      // In case of error, redirect to the dashboard
      setLocation('/');
    }
  }, [setLocation]);
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-bold mb-2">Authentication Complete</h1>
        <p className="text-muted-foreground">This window will close automatically</p>
      </div>
    </div>
  );
}