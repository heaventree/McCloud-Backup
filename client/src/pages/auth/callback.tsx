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
        const tokenData = params.get('token_data'); // Check if we received direct token data
        const authId = params.get('auth_id'); // Check for auth ID for localStorage method
        
        // Debug logging for all URL parameters
        console.log('URL parameters:', Object.fromEntries(params.entries()));
        console.log('Current pathname:', window.location.pathname);
        
        // First handle any errors
        if (error) {
          console.error('OAuth error parameter received:', error);
          setMessage(`Authentication error: ${error}`);
          
          // If we have an authId, record the error in localStorage
          if (authId) {
            try {
              localStorage.setItem(authId, JSON.stringify({
                status: 'error',
                error: error,
                timestamp: Date.now()
              }));
              console.log('Error recorded in localStorage for authId:', authId);
            } catch (err) {
              console.warn('Failed to store error in localStorage:', err);
            }
          }
          
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
        
        const provider = providers[providerPath] || 'dropbox'; // Default to Dropbox as fallback
        
        console.log('Provider detected:', provider);
        
        // First check for direct token data from server-side exchange
        if (tokenData) {
          console.log('Received direct token data from server');
          
          // Try using localStorage to communicate back to parent if we have an authId
          if (authId) {
            try {
              localStorage.setItem(authId, JSON.stringify({
                status: 'completed',
                token: tokenData,
                timestamp: Date.now(),
                provider
              }));
              console.log('Token stored in localStorage for authId:', authId);
              setMessage('Authentication successful! You can close this window.');
              
              // Attempt to self-close after a short delay
              setTimeout(() => {
                try {
                  window.close();
                } catch (err) {
                  console.warn('Could not close window automatically', err);
                }
              }, 1500);
              
              return;
            } catch (storageErr) {
              console.warn('Failed to store token in localStorage:', storageErr);
            }
          }
          
          // Fallback to postMessage if localStorage didn't work or no authId
          try {
            if (window.opener) {
              console.log('Sending token data to parent window via postMessage');
              
              window.opener.postMessage({
                type: 'OAUTH_TOKEN_DATA',
                provider,
                encryptedTokenData: tokenData
              }, window.location.origin);
              
              setMessage('Token received! Closing window...');
              
              // Close window after short delay
              setTimeout(() => {
                window.close();
                setMessage('Authentication complete. Please close this window if it does not close automatically.');
              }, 1000);
              
              return;
            }
          } catch (err) {
            console.error('Error sending message to parent:', err);
          }
        }
        
        // Handle missing authorization code
        if (!code) {
          console.error('No authorization code received in URL parameters');
          setMessage('No authorization code received. Authentication failed.');
          
          // If we have an authId, record the error
          if (authId) {
            try {
              localStorage.setItem(authId, JSON.stringify({
                status: 'error',
                error: 'No authorization code received',
                timestamp: Date.now()
              }));
            } catch (err) {
              console.warn('Failed to store error in localStorage:', err);
            }
          }
          
          return;
        }
        
        console.log('Authorization code received for provider:', provider);
        
        // Show status to the user
        setIsExchangingToken(true);
        setMessage('Exchanging code for access token...');
        
        // Exchange the code for an access token directly in this window
        try {
          // Call the token endpoint to exchange code for token
          const tokenEndpoint = `/api/auth/${provider}/token`;
          console.log(`Sending code to token endpoint: ${tokenEndpoint}`);
          
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
          
          console.log('Token exchange response status:', response.status);
          
          // Check for successful token exchange
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Error response from token endpoint:', errorText);
            
            // Record error in localStorage if we have an authId
            if (authId) {
              try {
                localStorage.setItem(authId, JSON.stringify({
                  status: 'error',
                  error: `Token exchange failed: ${response.status} - ${errorText}`,
                  timestamp: Date.now()
                }));
              } catch (err) {
                console.warn('Failed to store error in localStorage:', err);
              }
            }
            
            throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
          }
          
          // Get the token data
          const tokenDataResponse = await response.json();
          
          // Log the token data (with access token truncated for security)
          console.log('Token exchange successful, received data with keys:', 
            Object.keys(tokenDataResponse).join(', '));
          
          if (!tokenDataResponse.access_token) {
            console.error('No access token in response:', tokenDataResponse);
            
            // Record error in localStorage if we have an authId
            if (authId) {
              try {
                localStorage.setItem(authId, JSON.stringify({
                  status: 'error',
                  error: 'No access token received from server',
                  timestamp: Date.now()
                }));
              } catch (err) {
                console.warn('Failed to store error in localStorage:', err);
              }
            }
            
            throw new Error('No access token received from server');
          }
          
          // First try localStorage mechanism to communicate with parent window
          if (authId) {
            try {
              localStorage.setItem(authId, JSON.stringify({
                status: 'completed',
                token: tokenDataResponse.access_token,
                refreshToken: tokenDataResponse.refresh_token || null,
                timestamp: Date.now(),
                provider
              }));
              console.log('Token stored in localStorage for authId:', authId);
              setMessage('Authentication successful! You can close this window.');
              
              // Attempt to self-close after a short delay
              setTimeout(() => {
                try {
                  window.close();
                } catch (err) {
                  console.warn('Could not close window automatically', err);
                }
              }, 1500);
              
              return;
            } catch (storageErr) {
              console.warn('Failed to store token in localStorage:', storageErr);
            }
          }
          
          // Fallback to postMessage mechanism
          if (window.opener) {
            console.log('Falling back to postMessage mechanism');
            
            try {
              // Prepare the message to send
              const message = {
                type: 'OAUTH_CALLBACK',
                provider,
                tokenData: tokenDataResponse
              };
              
              console.log('Sending token to parent window for provider:', provider);
              
              // Send the token data to the parent window
              window.opener.postMessage(message, window.location.origin);
              console.log('Message sent to parent window');
            } catch (err) {
              console.error('Error sending message to parent:', err);
            }
            
            setMessage('Authentication successful! Closing window...');
            
            // Close the window after a brief delay
            setTimeout(() => {
              try {
                window.close();
              } catch (err) {
                // Some browsers may restrict window.close()
                console.warn('Could not close window automatically', err);
              }
              // Fallback message
              setMessage('Authentication complete. Please close this window if it does not close automatically.');
            }, 1500);
          } else {
            // If no opener, redirect to the dashboard
            console.log('No opener window found, redirecting to dashboard');
            setMessage('Authentication successful but popup context lost. Redirecting to dashboard...');
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
  const tokenData = params.get('token_data');
  const authId = params.get('auth_id');
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
          <p><span className="font-semibold">Auth ID:</span> {authId ? authId.substring(0, 10) + '...' : 'None'}</p>
          <p><span className="font-semibold">Code Present:</span> {code ? 'Yes' : 'No'}</p>
          <p><span className="font-semibold">Token Data Present:</span> {tokenData ? 'Yes' : 'No'}</p>
          <p><span className="font-semibold">Error:</span> {error || 'None'}</p>
          <p className="mt-2 text-xs text-gray-500">This page will close automatically after authentication</p>
          <button 
            onClick={() => window.close()}
            className="mt-4 px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
}