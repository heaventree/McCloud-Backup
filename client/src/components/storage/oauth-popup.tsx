import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

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

  const { name, icon, apiPath = providerType } = providerConfig[providerType];

  const handleOAuthClick = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    
    console.log(`Starting OAuth flow for ${providerType}`);
    
    try {
      // Set up message listener for the popup to communicate back
      const messageHandler = (event: MessageEvent) => {
        console.log('Message received from window:', {
          origin: event.origin,
          expectedOrigin: window.location.origin,
          hasData: !!event.data,
          dataType: event.data?.type,
          source: event.source ? 'present' : 'null'
        });
        
        // Validate origin for security
        if (event.origin !== window.location.origin) {
          console.log(`Ignoring message from unauthorized origin: ${event.origin}`);
          return;
        }
        
        // Handle direct encrypted token data (from server-side token exchange)
        if (event.data && event.data.type === 'OAUTH_TOKEN_DATA') {
          console.log('Received encrypted token data message from popup window', { 
            hasEncryptedData: !!event.data.encryptedTokenData, 
            provider: event.data.provider
          });
          
          window.removeEventListener('message', messageHandler);
          
          // Verify provider matches
          if (event.data.provider !== providerType) {
            console.error(`Provider mismatch. Expected ${providerType}, got ${event.data.provider}`);
            toast({
              title: 'Authentication error',
              description: 'Provider mismatch in OAuth callback',
              variant: 'destructive'
            });
            setIsLoading(false);
            setErrorMessage(`Provider mismatch. Expected ${providerType}, got ${event.data.provider}`);
            return;
          }
          
          // We need to send the encrypted data to the server to decrypt it
          // For now, we'll use a simplified approach and assume it contains a token
          if (event.data.encryptedTokenData) {
            console.log('Successfully received encrypted token data');
            setIsConnected(true);
            setIsLoading(false);
            
            // For now, we'll pass the encrypted data as the token
            // In a real app, we would decrypt this on the server
            onSuccess({ 
              token: event.data.encryptedTokenData
            });
            
            // Try to automatically close the popup after successful auth
            try {
              if (event.source && typeof (event.source as any).close === 'function') {
                (event.source as any).close();
              }
            } catch (err) {
              console.warn('Could not close popup window programmatically', err);
            }
          } else {
            console.error('No encrypted token data received');
            toast({
              title: 'Authentication failed',
              description: 'No token data received from provider',
              variant: 'destructive'
            });
            setIsLoading(false);
            setErrorMessage('No token data received');
          }
          
          return;
        }
        
        // Handle standard OAuth callback from the client-side token exchange
        if (event.data && event.data.type === 'OAUTH_CALLBACK') {
          console.log('Received OAUTH_CALLBACK message from popup window', { 
            hasTokenData: !!event.data.tokenData, 
            provider: event.data.provider,
            tokenKeys: event.data.tokenData ? Object.keys(event.data.tokenData) : []
          });
          
          // Remove the event listener as it's no longer needed
          window.removeEventListener('message', messageHandler);
          
          // Process the OAuth response
          if (event.data.error) {
            console.error('Error received from popup:', event.data.error);
            toast({
              title: 'Authentication failed',
              description: event.data.error,
              variant: 'destructive'
            });
            setIsLoading(false);
            setErrorMessage(event.data.error);
            return;
          }
          
          if (event.data.provider !== providerType) {
            console.error(`Provider mismatch. Expected ${providerType}, got ${event.data.provider}`);
            toast({
              title: 'Authentication error',
              description: 'Provider mismatch in OAuth callback',
              variant: 'destructive'
            });
            setIsLoading(false);
            setErrorMessage(`Provider mismatch. Expected ${providerType}, got ${event.data.provider}`);
            return;
          }
          
          // Extract token and pass to parent component
          const token = event.data.tokenData?.access_token;
          if (token) {
            console.log('Successfully received access token');
            setIsConnected(true);
            setIsLoading(false);
            // Invoke the success callback with the token
            onSuccess({ 
              token: token, 
              refreshToken: event.data.tokenData.refresh_token || undefined 
            });
            
            // Try to automatically close the popup after successful auth
            try {
              if (event.source && typeof (event.source as any).close === 'function') {
                (event.source as any).close();
              }
            } catch (err) {
              console.warn('Could not close popup window programmatically', err);
            }
          } else {
            console.error('No access token received');
            toast({
              title: 'Authentication failed',
              description: 'No access token received from provider',
              variant: 'destructive'
            });
            setIsLoading(false);
            setErrorMessage('No access token received');
          }
        }
      };
      
      // Add the event listener to receive messages from the popup
      window.addEventListener('message', messageHandler);
      
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
          
      console.log(`Opening popup with URL: ${authPath}`);
      
      // Add the current window's location as the origin parameter to help with debugging
      const popupUrl = new URL(authPath, window.location.origin);
      popupUrl.searchParams.append('origin', window.location.href);
      
      // Open the popup with the properly formatted URL
      const popup = window.open(
        popupUrl.toString(),
        `Connect to ${name}`,
        `width=${width},height=${height},left=${left},top=${top},location=yes,toolbar=no,menubar=no`
      );
      
      if (!popup) {
        toast({
          title: 'Popup blocked',
          description: 'Please enable popups for this site to connect to ' + name,
          variant: 'destructive',
        });
        window.removeEventListener('message', messageHandler);
        setIsLoading(false);
        return;
      }

      // Monitor the popup window to detect when it's closed
      const checkPopupClosed = setInterval(() => {
        if (!popup || popup.closed) {
          console.log('Popup closed');
          clearInterval(checkPopupClosed);
          
          // If the popup was closed but we didn't receive a token, 
          // that might mean the auth flow was canceled
          if (isLoading && !isConnected) {
            console.log('Popup closed without completing authentication');
            window.removeEventListener('message', messageHandler);
            setIsLoading(false);
            
            // If popup is closed before completing auth, show message
            toast({
              title: 'Authentication cancelled',
              description: 'The authentication window was closed before completion.',
              variant: 'default'
            });
          }
        }
      }, 1000);
    } catch (error) {
      console.error('Error in OAuth flow:', error);
      toast({
        title: 'Authentication error',
        description: error instanceof Error ? error.message : 'Unknown error occurred',
        variant: 'destructive',
      });
      setIsLoading(false);
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error');
    }
  };

  return (
    <div className={className}>
      <Button
        onClick={handleOAuthClick}
        disabled={isLoading}
        variant={isConnected ? "outline" : "default"}
        className="flex items-center justify-center w-full"
      >
        {icon}
        {isLoading ? (
          'Connecting...'
        ) : isConnected ? (
          `Connected to ${name}`
        ) : (
          `Connect to ${name}`
        )}
      </Button>
      {errorMessage && (
        <p className="text-sm text-red-500 mt-1">{errorMessage}</p>
      )}
    </div>
  );
};

export default OAuthPopup;