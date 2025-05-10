import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';

// Provider types must match between client, server, and database
type OAuthProviderType = 'google' | 'dropbox' | 'onedrive' | 'github';

interface OAuthPopupProps {
  providerType: OAuthProviderType;
  className?: string;
  onSuccess: (credentials: { token: string; refreshToken?: string }) => void;
  hasExistingToken?: boolean; // New prop to check if this provider already has a token
}

const providerConfig = {
  google: {
    name: 'Google Drive',
    apiPath: 'google', // The API path to use for OAuth
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mr-2"
      >
        <path d="M8 2V17L14 9.5" fill="currentColor" />
        <path
          d="M8 2V17L3 20M8 2L14 9.5L23 9M14 9.5L8 17L3 20M3 20L11 13L23 9"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  dropbox: {
    name: 'Dropbox',
    apiPath: 'dropbox', // The API path to use for OAuth
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mr-2"
      >
        <path d="M6 6L12 10.5L6 15L0 10.5L6 6Z" fill="currentColor" />
        <path d="M18 6L24 10.5L18 15L12 10.5L18 6Z" fill="currentColor" />
        <path d="M6 16L12 20.5L18 16L12 11.5L6 16Z" fill="currentColor" />
        <path d="M12 10.5L18 6L12 1.5L6 6L12 10.5Z" fill="currentColor" />
      </svg>
    ),
  },
  onedrive: {
    name: 'OneDrive',
    apiPath: 'onedrive', // The API path to use for OAuth
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mr-2"
      >
        <path d="M10.5 12.75L3 16.5L13.5 21L22.5 16.5L14 11.25L10.5 12.75Z" fill="currentColor" />
        <path d="M10.5 4.5L3 7.5L7.5 10.5L15.5 7.5L10.5 4.5Z" fill="currentColor" />
        <path d="M15 7.5L22.5 10.5L17 13.5L10 10.5L15 7.5Z" fill="currentColor" />
      </svg>
    ),
  },
  github: {
    name: 'GitHub',
    apiPath: 'github', // The API path to use for OAuth
    icon: (
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="mr-2"
      >
        <path
          d="M12 2C6.477 2 2 6.477 2 12c0 4.42 2.865 8.167 6.839 9.49.5.09.682-.217.682-.48 0-.238-.008-.866-.013-1.7-2.782.603-3.369-1.342-3.369-1.342-.454-1.155-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.577 9.577 0 0112 6.836c.85.004 1.705.114 2.504.336 1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.917.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.577.688.48C19.138 20.161 22 16.416 22 12c0-5.523-4.477-10-10-10z"
          fill="currentColor"
        />
      </svg>
    ),
  },
};

const OAuthPopup = ({
  providerType,
  className = '',
  onSuccess,
  hasExistingToken = false,
}: OAuthPopupProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(hasExistingToken);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const { toast } = useToast();

  // Update isConnected if hasExistingToken changes
  useEffect(() => {
    setIsConnected(hasExistingToken);
  }, [hasExistingToken]);

  // Ensure we're using the correct provider type
  console.log('Using provider type:', providerType);
  const { name, icon, apiPath = providerType } = providerConfig[providerType];

  const handleOAuthClick = async () => {
    setIsLoading(true);
    
    try {
      // Reset global callback object if it exists
      (window as any).oauthCallback = null;
      
      // Open the popup window for OAuth authentication
      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      // For Dropbox, use the /auth path instead of /api/auth to match registered redirect URI
      const authPath =
        providerType === 'dropbox'
          ? `/auth/${apiPath}/authorize`
          : `/api/auth/${apiPath}/authorize`;
      
      const popup = window.open(
        authPath,
        `Connect to ${name}`,
        `width=${width},height=${height},left=${left},top=${top},location=yes,toolbar=no,menubar=no`
      );
      
      if (!popup) {
        toast({
          title: 'Popup blocked',
          description: 'Please enable popups for this site to connect to ' + name,
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const processOAuthCallback = async (data: any) => {
        console.log('PARENT: Processing OAuth callback data:', {
          hasData: !!data,
          provider: data ? data.provider : 'none',
          apiPath,
          hasCode: data && !!data.code,
          hasError: data && !!data.error
        });
        
        if (data.error) {
          console.error('PARENT: OAuth error returned:', data.error);
          toast({
            title: 'Authentication failed',
            description: data.error,
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        
        if (!data.code) {
          console.error('PARENT: No authorization code returned');
          toast({
            title: 'Authentication failed',
            description: 'No authorization code received',
            variant: 'destructive',
          });
          setIsLoading(false);
          return;
        }
        
        console.log(`PARENT: OAuth callback received, exchanging code for token for ${apiPath}`);
        
        // Exchange the authorization code for tokens
        try {
          console.log(`PARENT: Calling token endpoint: /api/auth/${apiPath}/token`);
          const response = await apiRequest('POST', `/api/auth/${apiPath}/token`, {
            code: data.code,
          });
          
          const tokenData = await response.json();
          
          if (tokenData.error) {
            toast({
              title: 'Failed to get access token',
              description: tokenData.error,
              variant: 'destructive',
            });
          } else {
            console.log('Token exchange successful, updating state');
            setIsConnected(true);
            
            onSuccess({
              token: tokenData.access_token,
              refreshToken: tokenData.refresh_token,
            });
            
            toast({
              title: 'Connected successfully',
              description: `Your ${name} account is now connected`,
            });
          }
        } catch (error) {
          console.error('Token exchange error:', error);
          toast({
            title: 'Token exchange failed',
            description: error instanceof Error ? error.message : 'Unknown error',
            variant: 'destructive',
          });
        }
        
        setIsLoading(false);
      };
      
      // Method 1: Standard postMessage listener
      const handleMessage = async (event: MessageEvent) => {
        console.log('PARENT: Received message event:', {
          data: event.data,
          origin: event.origin,
          hasData: !!event.data,
          dataType: event.data ? event.data.type : 'none',
          provider: event.data ? event.data.provider : 'none',
          expectedProvider: providerType,
          matchesProvider: event.data && event.data.provider === providerType,
          timestamp: event.data ? event.data.timestamp : 'none'
        });
        
        // Use looser matching - ignore origin and just check if it's an OAuth callback with matching provider
        if (
          event.data &&
          event.data.type === 'oauth-callback' &&
          event.data.provider === providerType
        ) {
          console.log('PARENT: Found matching OAuth callback data in message');
          
          // Clean up all listeners
          window.removeEventListener('message', handleMessage);
          document.removeEventListener('oauth-callback-received', handleCustomEvent);
          clearInterval(checkPopupClosed);
          clearInterval(checkStorage);
          
          console.log('PARENT: Processing OAuth callback data from message');
          await processOAuthCallback(event.data);
          
          // Close popup if still open
          if (popup && !popup.closed) {
            try {
              console.log('PARENT: Closing popup window');
              popup.close();
            } catch (e) {
              console.error('Error closing popup:', e);
            }
          }
        } else {
          console.log('PARENT: Message event did not match expected criteria');
        }
      };
      
      // Method 2: Custom event listener
      const handleCustomEvent = async (event: Event) => {
        const customEvent = event as CustomEvent;
        console.log('PARENT: Received custom event:', {
          detail: customEvent.detail,
          hasDetail: !!customEvent.detail,
          detailType: customEvent.detail ? customEvent.detail.type : 'none',
          provider: customEvent.detail ? customEvent.detail.provider : 'none',
          expectedProvider: providerType,
          matchesProvider: customEvent.detail && customEvent.detail.provider === providerType
        });
        
        if (
          customEvent.detail &&
          customEvent.detail.type === 'oauth-callback' &&
          customEvent.detail.provider === providerType
        ) {
          console.log('PARENT: Found matching OAuth callback data in custom event');
          
          // Clean up all listeners
          window.removeEventListener('message', handleMessage);
          document.removeEventListener('oauth-callback-received', handleCustomEvent);
          clearInterval(checkPopupClosed);
          clearInterval(checkStorage);
          
          console.log('PARENT: Processing OAuth callback data from custom event');
          await processOAuthCallback(customEvent.detail);
          
          // Close popup if still open
          if (popup && !popup.closed) {
            try {
              console.log('PARENT: Closing popup window after custom event');
              popup.close();
            } catch (e) {
              console.error('Error closing popup:', e);
            }
          }
        } else {
          console.log('PARENT: Custom event did not match expected criteria');
        }
      };
      
      // Add event listeners
      window.addEventListener('message', handleMessage);
      document.addEventListener('oauth-callback-received', handleCustomEvent);
      
      // NEW METHOD: Poll for localStorage data
      let pollCount = 0;
      const checkStorage = setInterval(() => {
        pollCount++;
        
        try {
          // Check if we have a latest callback key
          const latestKey = localStorage.getItem('latest_oauth_callback_key');
          if (latestKey) {
            // Try to get the callback data
            const callbackDataString = localStorage.getItem(latestKey);
            
            if (callbackDataString) {
              try {
                const callbackData = JSON.parse(callbackDataString);
                
                if (pollCount % 4 === 0) { // Log every 2 seconds
                  console.log('PARENT: Checking localStorage (attempt ' + pollCount + '):', {
                    key: latestKey,
                    hasData: !!callbackData,
                    callbackType: callbackData ? callbackData.type : 'none',
                    provider: callbackData ? callbackData.provider : 'none',
                    expectedProvider: providerType,
                    matchesProvider: callbackData && callbackData.provider === providerType,
                    timestamp: callbackData ? callbackData.timestamp : 'none',
                  });
                }
                
                // Check if this callback data is for our provider
                if (callbackData.type === 'oauth-callback' && callbackData.provider === providerType) {
                  console.log('PARENT: Found matching OAuth callback data in localStorage');
                  
                  // Clean up all listeners
                  window.removeEventListener('message', handleMessage);
                  document.removeEventListener('oauth-callback-received', handleCustomEvent);
                  clearInterval(checkPopupClosed);
                  clearInterval(checkStorage);
                  
                  // Process the callback data
                  console.log('PARENT: Processing OAuth callback data from localStorage');
                  processOAuthCallback(callbackData);
                  
                  // Remove the data from localStorage to clean up
                  localStorage.removeItem(latestKey);
                  localStorage.removeItem('latest_oauth_callback_key');
                  
                  // Close popup if still open
                  if (popup && !popup.closed) {
                    try {
                      console.log('PARENT: Closing popup window after localStorage check');
                      popup.close();
                    } catch (e) {
                      console.error('Error closing popup:', e);
                    }
                  }
                }
              } catch (parseError) {
                console.error('Error parsing callback data from localStorage:', parseError);
              }
            }
          }
        } catch (storageError) {
          console.error('Error accessing localStorage:', storageError);
        }
      }, 500);
      
      // Handle popup closing
      const checkPopupClosed = setInterval(() => {
        if (!popup || popup.closed) {
          console.log('PARENT: Popup closed by user or completed authentication');
          
          // Check localStorage one last time before cleaning up
          try {
            const latestKey = localStorage.getItem('latest_oauth_callback_key');
            if (latestKey) {
              const callbackDataString = localStorage.getItem(latestKey);
              if (callbackDataString) {
                try {
                  const callbackData = JSON.parse(callbackDataString);
                  
                  // If this is for our provider, process it
                  if (callbackData.type === 'oauth-callback' && callbackData.provider === providerType) {
                    console.log('PARENT: Found callback data in localStorage during cleanup');
                    processOAuthCallback(callbackData);
                    localStorage.removeItem(latestKey);
                    localStorage.removeItem('latest_oauth_callback_key');
                    
                    // Clean up and we're done
                    window.removeEventListener('message', handleMessage);
                    document.removeEventListener('oauth-callback-received', handleCustomEvent);
                    clearInterval(checkPopupClosed);
                    clearInterval(checkStorage);
                    return;
                  }
                } catch (parseError) {
                  console.error('PARENT: Error parsing callback data during cleanup:', parseError);
                }
              }
            }
          } catch (storageError) {
            console.error('PARENT: Error checking localStorage during cleanup:', storageError);
          }
          
          // Clean up event listeners and intervals
          clearInterval(checkPopupClosed);
          clearInterval(checkStorage);
          window.removeEventListener('message', handleMessage);
          document.removeEventListener('oauth-callback-received', handleCustomEvent);
          
          // Only show an error if we were still loading (user canceled before completion)
          if (isLoading) {
            console.log('PARENT: User canceled authentication before completion');
            setIsLoading(false);
            setErrorMessage('Authentication was canceled');
          }
        }
      }, 500);
    } catch (error) {
      console.error('OAuth connection error:', error);
      toast({
        title: 'Connection error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };

  return (
    <Button
      variant={isConnected ? 'default' : 'outline'}
      className={`flex w-full items-center justify-center ${className} ${isConnected ? 'bg-green-600 hover:bg-green-700' : ''}`}
      onClick={handleOAuthClick}
      disabled={isLoading}
    >
      {icon}
      {isLoading
        ? `Connecting to ${name}...`
        : isConnected
          ? `Connected to ${name}`
          : `Connect to ${name}`}
    </Button>
  );
};

export default OAuthPopup;
