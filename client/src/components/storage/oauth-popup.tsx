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
      // For Dropbox direct token method, we'll use a simpler approach that doesn't rely on message passing
      // Instead we'll use localStorage as the communication mechanism, which is more reliable 
      // across different browsers

      // Create a unique ID for this authentication attempt
      const authId = `oauth_${providerType}_${Date.now()}`;
      
      // Store that we initiated an auth flow with this ID
      localStorage.setItem(authId, JSON.stringify({
        status: 'initiated',
        provider: providerType,
        timestamp: Date.now()
      }));
      
      // Set up a direct check for auth completion using localStorage
      // This approach is more reliable than message passing which can be flaky
      const checkAuthCompletion = setInterval(() => {
        try {
          // Check if our auth has been completed
          const authDataStr = localStorage.getItem(authId);
          if (!authDataStr) return;
          
          const authData = JSON.parse(authDataStr);
          
          if (authData.status === 'completed' && authData.token) {
            console.log('Found successful authentication in localStorage');
            clearInterval(checkAuthCompletion);
            
            // Clear storage item after reading it
            localStorage.removeItem(authId);
            
            setIsConnected(true);
            setIsLoading(false);
            
            // Pass the token to the callback
            onSuccess({
              token: authData.token,
              refreshToken: authData.refreshToken
            });
            
            // Show success message
            toast({
              title: 'Authentication successful',
              description: `Successfully connected to ${name}`,
              variant: 'default'
            });
          } else if (authData.status === 'error') {
            console.error('Auth error found in localStorage:', authData.error);
            clearInterval(checkAuthCompletion);
            
            // Clear storage item after reading it
            localStorage.removeItem(authId);
            
            setIsLoading(false);
            setErrorMessage(authData.error || 'Authentication failed');
            
            toast({
              title: 'Authentication failed',
              description: authData.error || 'Failed to authenticate',
              variant: 'destructive'
            });
          }
        } catch (err) {
          console.warn('Error checking auth status:', err);
        }
      }, 500);
      
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
      
      // Add the authId as a parameter so the callback knows which auth attempt this is
      const popupUrl = new URL(authPath, window.location.origin);
      popupUrl.searchParams.append('auth_id', authId);
      
      console.log(`Opening popup with URL: ${popupUrl.toString()}`);
      
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
        clearInterval(checkAuthCompletion);
        localStorage.removeItem(authId);
        setIsLoading(false);
        return;
      }

      // Monitor the popup window to detect when it's closed
      const checkPopupClosed = setInterval(() => {
        if (!popup || popup.closed) {
          console.log('Popup closed');
          clearInterval(checkPopupClosed);
          
          // Check if we already got a token (success case)
          const authDataStr = localStorage.getItem(authId);
          if (authDataStr) {
            const authData = JSON.parse(authDataStr);
            if (authData.status === 'completed') {
              // Success already handled by the other interval
              return;
            }
          }
          
          // If we get here, the popup was closed but we didn't get a token
          // This is likely a user cancellation
          if (isLoading) {
            console.log('Popup closed without completing authentication');
            clearInterval(checkAuthCompletion);
            localStorage.removeItem(authId);
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
      
      // Set a timeout to abort the authentication attempt if it takes too long
      setTimeout(() => {
        // Check if we're still loading
        if (isLoading) {
          console.log('Authentication timed out after 2 minutes');
          clearInterval(checkAuthCompletion);
          clearInterval(checkPopupClosed);
          
          // Check one more time for token before declaring timeout
          const authDataStr = localStorage.getItem(authId);
          if (authDataStr) {
            const authData = JSON.parse(authDataStr);
            if (authData.status === 'completed') {
              return; // Success was handled at the last moment
            }
          }
          
          // Record the timeout in localStorage so the popup can detect it if still open
          localStorage.setItem(authId, JSON.stringify({
            status: 'error',
            provider: providerType,
            timestamp: Date.now(),
            error: 'Authentication timed out. Please try again.'
          }));
          
          // Perform cleanup
          try {
            if (popup && !popup.closed) {
              popup.close();
            }
          } catch (err) {
            console.warn('Error closing popup:', err);
          }
          
          setIsLoading(false);
          setErrorMessage('Authentication timed out. Please try again.');
          
          toast({
            title: 'Authentication timed out',
            description: 'Please try again.',
            variant: 'destructive'
          });
        }
      }, 120000); // 2 minute timeout
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