import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';

/**
 * A simplified callback handler for OAuth redirects
 * This page is designed to be as simple as possible to avoid errors
 */
export default function SimpleCallback() {
  const [message, setMessage] = useState<string>('Processing authentication response...');
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Function to store the OAuth data and redirect
    const processOAuthResponse = () => {
      try {
        // Get URL params
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');
        const state = params.get('state');

        // Extract provider from state if available
        let provider = 'dropbox'; // Default to dropbox
        
        if (state) {
          try {
            const stateParams = new URLSearchParams(state);
            const stateProvider = stateParams.get('provider');
            if (stateProvider) {
              provider = stateProvider;
            }
          } catch (e) {
            console.error('Error parsing state parameter:', e);
          }
        }

        console.log('OAuth response received:', {
          code: code ? `present (${code.length} chars)` : 'missing',
          error: error || 'none',
          state: state || 'none',
          provider
        });

        if (error) {
          setMessage(`Authentication error: ${error}`);
          localStorage.setItem('oauth_error', error);
          setTimeout(() => {
            window.location.href = '/storage-providers';
          }, 2000);
          return;
        }

        if (!code) {
          setMessage('Authentication failed: No authorization code received');
          localStorage.setItem('oauth_error', 'No authorization code received');
          setTimeout(() => {
            window.location.href = '/storage-providers';
          }, 2000);
          return;
        }

        // Store the OAuth data in localStorage for the main app to retrieve
        const oauthData = {
          type: 'oauth-callback',
          provider,
          code,
          timestamp: Date.now(),
        };

        const storageKey = `oauth_callback_${Date.now()}`;
        localStorage.setItem(storageKey, JSON.stringify(oauthData));
        localStorage.setItem('latest_oauth_callback_key', storageKey);

        setMessage('Authentication successful! Redirecting...');
        
        // Redirect back to the storage providers page
        setTimeout(() => {
          window.location.href = '/storage-providers';
        }, 1500);
      } catch (error) {
        console.error('Error in SimpleCallback:', error);
        setMessage('An error occurred during authentication');
        setTimeout(() => {
          window.location.href = '/storage-providers';
        }, 2000);
      }
    };

    // Process the OAuth response immediately
    processOAuthResponse();
  }, [setLocation]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-xl font-bold">Authentication Status</h1>
        <p className="mb-4 text-muted-foreground">{message}</p>
        
        <div className="animate-pulse flex justify-center space-x-2">
          <div className="w-2 h-2 bg-primary rounded-full"></div>
          <div className="w-2 h-2 bg-primary rounded-full"></div>
          <div className="w-2 h-2 bg-primary rounded-full"></div>
        </div>
        
        <p className="mt-8 text-sm text-muted-foreground">
          You will be redirected automatically.
          If not, <a href="/storage-providers" className="text-primary underline">click here</a>.
        </p>
      </div>
    </div>
  );
}