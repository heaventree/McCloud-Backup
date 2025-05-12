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
  const { name, icon, apiPath } = providerConfig[providerType] || providerConfig.dropbox;

  const handleOAuthClick = () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    // For better debugging - log which provider we're trying to connect to
    console.log(`OAUTH: Starting OAuth flow for provider: ${providerType}`);
    
    try {
      // Clear any previous OAuth data in localStorage to prevent conflicts
      const previousKey = localStorage.getItem('latest_oauth_callback_key');
      if (previousKey) {
        console.log('OAUTH: Clearing previous OAuth data from localStorage');
        localStorage.removeItem(previousKey);
        localStorage.removeItem('latest_oauth_callback_key');
      }
      
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
          
      // Log the actual URL being used for authorization
      console.log(`OAUTH: Opening popup with URL: ${authPath}`);
      
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

      // Function to handle message events from the popup
      const handleMessage = (event: MessageEvent) => {
        console.log('Received message from popup:', event.data);
        
        if (event.data && event.data.type === 'oauth-callback' && event.data.provider === providerType) {
          window.removeEventListener('message', handleMessage);
          
          const data = event.data;
          
          if (data.error) {
            console.error('OAuth error:', data.error);
            toast({
              title: 'Authentication failed',
              description: data.error,
              variant: 'destructive',
            });
            setErrorMessage(data.error);
            setIsLoading(false);
            return;
          }
          
          if (!data.code) {
            console.error('No authorization code received');
            toast({
              title: 'Authentication failed',
              description: 'No authorization code received',
              variant: 'destructive',
            });
            setErrorMessage('No authorization code received');
            setIsLoading(false);
            return;
          }
          
          // Exchange authorization code for token
          console.log('Exchanging code for token');
          exchangeCodeForToken(data.code);
        }
      };
      
      // Check for popup closing
      const checkPopupClosed = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopupClosed);
          window.removeEventListener('message', handleMessage);
          
          // Check localStorage one last time
          const key = localStorage.getItem('latest_oauth_callback_key');
          if (key) {
            const data = localStorage.getItem(key);
            if (data) {
              try {
                const callbackData = JSON.parse(data);
                if (callbackData.type === 'oauth-callback' && callbackData.provider === providerType && callbackData.code) {
                  console.log('Found callback data in localStorage after popup closed');
                  localStorage.removeItem(key);
                  localStorage.removeItem('latest_oauth_callback_key');
                  exchangeCodeForToken(callbackData.code);
                  return;
                }
              } catch (e) {
                console.error('Error parsing localStorage data:', e);
              }
            }
          }
          
          // Only set loading to false if we didn't find valid callback data
          console.log('Popup closed without completing authentication');
          setIsLoading(false);
        }
      }, 500);
      
      // Listen for messages from the popup
      window.addEventListener('message', handleMessage);
      
      // Check localStorage periodically for callback data
      const checkStorage = setInterval(() => {
        const key = localStorage.getItem('latest_oauth_callback_key');
        if (key) {
          const data = localStorage.getItem(key);
          if (data) {
            try {
              const callbackData = JSON.parse(data);
              if (callbackData.type === 'oauth-callback' && callbackData.provider === providerType && callbackData.code) {
                console.log('Found callback data in localStorage');
                clearInterval(checkStorage);
                clearInterval(checkPopupClosed);
                window.removeEventListener('message', handleMessage);
                localStorage.removeItem(key);
                localStorage.removeItem('latest_oauth_callback_key');
                exchangeCodeForToken(callbackData.code);
              }
            } catch (e) {
              console.error('Error parsing localStorage data:', e);
            }
          }
        }
      }, 500);
      
    } catch (error) {
      console.error('Error opening OAuth popup:', error);
      toast({
        title: 'Authentication error',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  };
  
  // Function to exchange authorization code for token
  const exchangeCodeForToken = async (code: string) => {
    try {
      console.log(`Calling token endpoint: /api/auth/${apiPath}/token`);
      const response = await apiRequest('POST', `/api/auth/${apiPath}/token`, {
        code: code,
        provider: providerType,
      });
      
      const tokenData = await response.json();
      
      if (tokenData.error) {
        console.error('Token endpoint returned error:', tokenData.error);
        toast({
          title: 'Failed to get access token',
          description: tokenData.error,
          variant: 'destructive',
        });
        setErrorMessage(`Token error: ${tokenData.error}`);
        setIsLoading(false);
        return;
      }
      
      if (!tokenData.access_token) {
        console.error('Token response missing access_token');
        toast({
          title: 'Invalid token response',
          description: 'The server returned a response without an access token',
          variant: 'destructive',
        });
        setErrorMessage('Missing access token in response');
        setIsLoading(false);
        return;
      }
      
      console.log('Token exchange successful');
      setIsConnected(true);
      
      onSuccess({
        token: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
      });
      
      toast({
        title: 'Connected successfully',
        description: `Your ${name} account is now connected`,
      });
      
      setIsLoading(false);
    } catch (error) {
      console.error('Token exchange error:', error);
      toast({
        title: 'Token exchange failed',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
      setErrorMessage(error instanceof Error ? error.message : 'Unknown token exchange error');
      setIsLoading(false);
    }
  };

  return (
    <div className={className}>
      {isConnected ? (
        <div className="flex items-center">
          {icon}
          <span className="text-sm text-green-600 dark:text-green-500 font-medium mr-2">
            Connected to {name}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setIsConnected(false);
              // Call onDisconnect if needed
            }}
          >
            Disconnect
          </Button>
        </div>
      ) : (
        <div className="flex flex-col space-y-2">
          <Button
            variant="outline"
            className="justify-start"
            onClick={handleOAuthClick}
            disabled={isLoading}
          >
            {icon}
            <span>{isLoading ? `Connecting to ${name}...` : `Connect to ${name}`}</span>
          </Button>
          {errorMessage && (
            <div className="text-sm text-red-500 mt-1">{errorMessage}</div>
          )}
        </div>
      )}
    </div>
  );
};

export default OAuthPopup;