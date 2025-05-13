import { useEffect, useState } from "react";
import { useLocation } from "wouter";

type ProviderType = 'google' | 'dropbox' | 'onedrive' | 'github';

/**
 * This page is the OAuth callback that receives the authorization code from providers.
 * It fetches the token directly from the server and passes it back to the parent window.
 */
export default function Callback() {
  const [, setLocation] = useLocation();
  const [isExchangingToken, setIsExchangingToken] = useState(false);
  const [message, setMessage] = useState('Processing authentication...');
  
  useEffect(() => {
    async function processOAuthCallback() {
      try {
        // Get the URL parameters
        const params = new URLSearchParams(window.location.search);
        const code = params.get('code');
        const error = params.get('error');
        
        if (error) {
          setMessage(`Authentication error: ${error}`);
          return;
        }
        
        if (!code) {
          setMessage('No authorization code received. Authentication failed.');
          return;
        }
        
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
        
        console.log('Authorization code received for provider:', provider);
        
        // Show status to the user
        setIsExchangingToken(true);
        setMessage('Exchanging code for access token...');
        
        // Exchange the code for an access token directly in this window
        try {
          // Call the token endpoint to exchange code for token
          const tokenEndpoint = `/api/auth/${provider}/token`;
          const response = await fetch(tokenEndpoint, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              code,
              provider,
            }),
          });
          
          // Check for successful token exchange
          if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
          }
          
          // Get the token data
          const tokenData = await response.json();
          
          // Log the token data (with access token truncated for security)
          console.log('Token exchange successful, received data with keys:', 
            Object.keys(tokenData).join(', '));
          
          if (!tokenData.access_token) {
            throw new Error('No access token received from server');
          }
          
          // Success! Send the token data to parent window
          if (window.opener) {
            // Send the token data to the parent window
            window.opener.postMessage({
              type: 'OAUTH_CALLBACK',
              provider,
              tokenData
            }, window.location.origin);
            
            setMessage('Authentication successful! Closing window...');
            
            // Close the window after a brief delay
            setTimeout(() => {
              window.close();
            }, 1000);
          } else {
            // If no opener, redirect to the dashboard
            setMessage('Authentication successful but opener window not found.');
            setTimeout(() => {
              setLocation('/');
            }, 1500);
          }
        } catch (error) {
          console.error('Error exchanging code for token:', error);
          setMessage(`Error getting access token: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } catch (error) {
        console.error('Error in OAuth callback:', error);
        setMessage(`Authentication error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    processOAuthCallback();
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
        <h1 className="text-xl font-bold mb-2">Authentication {isExchangingToken ? 'In Progress' : 'Complete'}</h1>
        <p id="message" className="text-muted-foreground">{message}</p>
        
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