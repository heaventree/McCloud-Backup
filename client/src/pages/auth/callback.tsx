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
      
      // First, log the complete authorization code for debugging
      console.log('OAUTH AUTHORIZATION CODE RECEIVED:', code);
      console.log('FULL URL WITH PARAMS:', window.location.href);
      
      // Send the data back to the opener window
      if (window.opener) {
        // Use consistent provider naming across the application
        // We should use the same provider type that's expected in storage_providers table
        const providerType = provider;
        
        console.log('Sending OAuth callback data to opener:', {
          type: 'oauth-callback',
          provider: providerType,
          code: code ? 'PRESENT' : 'MISSING',
          error
        });
        
        // Try multiple approaches to communicate with the parent window
        console.log('AUTH CALLBACK DATA:', {
          provider: providerType,
          code: code ? 'PRESENT (see console for full code)' : 'MISSING',
          error,
          hasOpener: !!window.opener,
          location: window.location.href
        });
        
        try {
          // NEW METHOD: Store OAuth data in localStorage for reliable retrieval
          const oauthData = {
            type: 'oauth-callback',
            provider: providerType,
            code,
            error,
            timestamp: Date.now()
          };
          
          // Generate a unique key for this OAuth session to prevent conflicts
          const storageKey = `oauth_callback_${providerType}_${Date.now()}`;
          
          // Store the data and the key
          localStorage.setItem(storageKey, JSON.stringify(oauthData));
          localStorage.setItem('latest_oauth_callback_key', storageKey);
          
          console.log('OAuth data stored in localStorage with key:', storageKey);
          
          // Also try the original methods as fallbacks
          
          // Method 1: Standard postMessage API
          console.log('Also attempting postMessage to parent window...');
          try {
            const currentOrigin = window.location.origin;
            window.opener.postMessage({
              type: 'oauth-callback',
              provider: providerType,
              code,
              error,
              timestamp: Date.now(),
              storageKey // Include the storage key in the message
            }, '*');
          } catch (postMsgError) {
            console.warn('Error with postMessage:', postMsgError);
          }
        } catch (e) {
          console.error('Error storing OAuth data:', e);
        }
        
        // Method 2: Try to set a global variable in the parent window
        try {
          if (window.opener) {
            console.log('Setting window.opener.oauthCallback global variable');
            // Set it directly on the window object of the parent
            window.opener.oauthCallback = {
              type: 'oauth-callback',
              provider: providerType,
              code,
              error,
              timestamp: Date.now()
            };
            
            // Also try to make it directly accessible as window.oauthCallback in parent
            // This uses eval to avoid same-origin policy issues
            window.opener.eval(`
              window.oauthCallback = {
                type: 'oauth-callback',
                provider: '${providerType}',
                code: ${code ? `'${code}'` : 'null'},
                error: ${error ? `'${error}'` : 'null'},
                timestamp: ${Date.now()}
              };
              console.log('OAuth callback data set by child window:', window.oauthCallback);
            `);
          }
        } catch (e) {
          console.error('Error setting parent window variable:', e);
        }
        
        // Method 3: Try to trigger a custom event in the parent window
        try {
          if (window.opener) {
            console.log('Dispatching custom event to parent window');
            
            const callbackEvent = new CustomEvent('oauth-callback-received', { 
              detail: {
                type: 'oauth-callback',
                provider: providerType,
                code,
                error,
                timestamp: Date.now()
              }
            });
            
            // Try dispatching on document
            window.opener.document.dispatchEvent(callbackEvent);
            
            // Also try to dispatch via eval to ensure it runs in parent context
            window.opener.eval(`
              try {
                const callbackEvent = new CustomEvent('oauth-callback-received', { 
                  detail: {
                    type: 'oauth-callback',
                    provider: '${providerType}',
                    code: ${code ? `'${code}'` : 'null'},
                    error: ${error ? `'${error}'` : 'null'},
                    timestamp: ${Date.now()}
                  }
                });
                document.dispatchEvent(callbackEvent);
                console.log('Custom event dispatched in parent context:', callbackEvent.detail);
              } catch (e) {
                console.error('Error dispatching event in parent eval:', e);
              }
            `);
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
  
  // Extract code info for displaying
  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');
  const error = params.get('error');
  const pathSegments = window.location.pathname.split('/');
  const providerPath = pathSegments[pathSegments.length - 2];
  
  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center">
        <h1 className="text-xl font-bold mb-2">Authentication Complete</h1>
        <p id="message" className="text-muted-foreground">This window will close automatically</p>
        
        {/* Debug information for OAuth callback */}
        <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-800 rounded text-left text-sm overflow-auto max-w-lg">
          <h2 className="font-bold mb-2">Debug Information:</h2>
          <p><span className="font-semibold">Provider:</span> {providerPath}</p>
          <p><span className="font-semibold">Code Present:</span> {code ? 'Yes' : 'No'}</p>
          <p><span className="font-semibold">Code Length:</span> {code ? code.length : 0}</p>
          <p><span className="font-semibold">Error:</span> {error || 'None'}</p>
          <p className="mt-2 text-xs text-gray-500">This debug info is only visible during development</p>
        </div>
      </div>
    </div>
  );
}