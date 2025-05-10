import { useEffect } from "react";
import { useLocation } from "wouter";

type ProviderType = 'google' | 'dropbox' | 'onedrive' | 'github';

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
        'github': 'github',
      };
      
      const provider = providers[providerPath] || 'google';
      
      // Send the data back to the opener window
      if (window.opener) {
        // Use consistent provider naming across the application
        // We should use the same provider type that's expected in storage_providers table
        const providerType = provider;
        
        console.log('Sending OAuth callback data to opener:', {
          type: 'oauth-callback',
          provider: providerType,
          code,
          error
        });
        
        // Try multiple approaches to communicate with the parent window
        try {
          // Method 1: Standard postMessage API
          window.opener.postMessage({
            type: 'oauth-callback',
            provider: providerType,
            code,
            error,
          }, '*'); // Use * instead of origin to ensure it works across all environments
        } catch (e) {
          console.error('Error using postMessage:', e);
        }
        
        // Method 2: Try to set a global variable in the parent window
        try {
          if (window.opener) {
            window.opener.oauthCallback = {
              type: 'oauth-callback',
              provider: providerType,
              code,
              error,
              timestamp: Date.now()
            };
          }
        } catch (e) {
          console.error('Error setting parent window variable:', e);
        }
        
        // Method 3: Try to trigger a custom event in the parent window
        try {
          if (window.opener) {
            const callbackEvent = new CustomEvent('oauth-callback-received', { 
              detail: {
                type: 'oauth-callback',
                provider: providerType,
                code,
                error,
              }
            });
            window.opener.document.dispatchEvent(callbackEvent);
          }
        } catch (e) {
          console.error('Error dispatching event to parent:', e);
        }
        
        // Show a message to the user before closing
        const messageElement = document.getElementById('message');
        if (messageElement) {
          messageElement.textContent = 'Authentication successful! Closing window...';
        }
        
        // Close this window after a brief delay
        setTimeout(() => {
          window.close();
          
          // In case window.close() doesn't work (which happens in some browsers)
          document.body.innerHTML = `
            <div class="flex min-h-screen items-center justify-center">
              <div class="text-center">
                <h1 class="text-xl font-bold mb-2">Authentication Complete</h1>
                <p class="text-muted-foreground">You can now close this window and return to the application.</p>
                <button 
                  class="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600" 
                  onclick="window.close()">
                  Close Window
                </button>
              </div>
            </div>
          `;
        }, 1000);
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
        <p id="message" className="text-muted-foreground">This window will close automatically</p>
      </div>
    </div>
  );
}