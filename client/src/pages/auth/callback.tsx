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
        
        // Debug logging for all URL parameters
        console.log('URL parameters:', Object.fromEntries(params.entries()));
        console.log('Current pathname:', window.location.pathname);
        
        if (error) {
          console.error('OAuth error parameter received:', error);
          setMessage(`Authentication error: ${error}`);
          return;
        }
        
        if (!code) {
          console.error('No authorization code received in URL parameters');
          setMessage('No authorization code received. Authentication failed.');
          return;
        }
        
        // Get the provider from the URL path
        const pathSegments = window.location.pathname.split('/');
        const providerPath = pathSegments[pathSegments.length - 2];
        
        console.log('Path segments:', pathSegments);
        console.log('Detected provider path:', providerPath);
        
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
            console.log('Parent window detected, sending message back');
            
            try {
              // Prepare the message to send
              const message = {
                type: 'OAUTH_CALLBACK',
                provider,
                tokenData
              };
              
              console.log('Sending message to parent window:', {
                messageType: message.type,
                provider: message.provider,
                hasTokenData: !!message.tokenData,
                origin: window.location.origin
              });
              
              // Send the token data to the parent window
              window.opener.postMessage(message, window.location.origin);
              console.log('Message sent to parent window');
            } catch (err) {
              console.error('Error sending message to parent:', err);
            }
            
            setMessage('Authentication successful! Closing window...');
            
            // Close the window after a brief delay
            console.log('Setting timer to close window in 1 second');
            const closeTimer = setTimeout(() => {
              console.log('Attempting to close window now');
              window.close();
              // If window.close() doesn't work (browsers may block it)
              setMessage('Window should close automatically. If not, please close this window manually.');
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