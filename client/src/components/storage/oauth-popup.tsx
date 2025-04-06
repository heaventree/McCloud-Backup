import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type OAuthProviderType = "google_drive" | "dropbox" | "onedrive";

interface OAuthPopupProps {
  providerType: OAuthProviderType;
  className?: string;
  onSuccess: (credentials: { token: string; refreshToken?: string }) => void;
}

const providerConfig = {
  google_drive: {
    name: "Google Drive",
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
    name: "Dropbox",
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
          d="M6 6L12 10.5L6 15L0 10.5L6 6Z"
          fill="currentColor"
        />
        <path
          d="M18 6L24 10.5L18 15L12 10.5L18 6Z"
          fill="currentColor"
        />
        <path
          d="M6 16L12 20.5L18 16L12 11.5L6 16Z"
          fill="currentColor"
        />
        <path
          d="M12 10.5L18 6L12 1.5L6 6L12 10.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
  onedrive: {
    name: "OneDrive",
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
          d="M10.5 12.75L3 16.5L13.5 21L22.5 16.5L14 11.25L10.5 12.75Z"
          fill="currentColor"
        />
        <path
          d="M10.5 4.5L3 7.5L7.5 10.5L15.5 7.5L10.5 4.5Z"
          fill="currentColor"
        />
        <path
          d="M15 7.5L22.5 10.5L17 13.5L10 10.5L15 7.5Z"
          fill="currentColor"
        />
      </svg>
    ),
  },
};

const OAuthPopup = ({ providerType, className = "", onSuccess }: OAuthPopupProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();
  const { name, icon } = providerConfig[providerType];

  const handleOAuthClick = async () => {
    setIsLoading(true);
    
    try {
      // Open the popup window for OAuth authentication
      const width = 600;
      const height = 600;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;
      
      const popup = window.open(
        `/api/auth/${providerType}/authorize`,
        `Connect to ${name}`,
        `width=${width},height=${height},left=${left},top=${top},location=no,toolbar=no,menubar=no`
      );
      
      if (!popup) {
        toast({
          title: "Popup blocked",
          description: "Please enable popups for this site to connect to " + name,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      // Set up message listener to receive the authorization code
      const handleMessage = async (event: MessageEvent) => {
        if (
          event.data &&
          event.data.type === "oauth-callback" &&
          event.data.provider === providerType
        ) {
          // Remove event listener
          window.removeEventListener("message", handleMessage);
          
          if (event.data.error) {
            toast({
              title: "Authentication failed",
              description: event.data.error,
              variant: "destructive",
            });
            setIsLoading(false);
            return;
          }
          
          // Exchange the authorization code for tokens
          try {
            const response = await apiRequest(
              "POST",
              `/api/auth/${providerType}/token`,
              { code: event.data.code }
            );
            
            const data = await response.json();
            
            if (data.error) {
              toast({
                title: "Failed to get access token",
                description: data.error,
                variant: "destructive",
              });
            } else {
              onSuccess({
                token: data.access_token,
                refreshToken: data.refresh_token,
              });
              
              toast({
                title: "Connected successfully",
                description: `Your ${name} account is now connected`,
              });
            }
          } catch (error) {
            toast({
              title: "Token exchange failed",
              description: error instanceof Error ? error.message : "Unknown error",
              variant: "destructive",
            });
          }
          
          setIsLoading(false);
        }
      };
      
      window.addEventListener("message", handleMessage);
      
      // Handle popup closing
      const checkPopupClosed = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(checkPopupClosed);
          window.removeEventListener("message", handleMessage);
          setIsLoading(false);
        }
      }, 500);
      
    } catch (error) {
      toast({
        title: "Connection error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      });
      setIsLoading(false);
    }
  };

  return (
    <Button 
      variant="outline" 
      className={`w-full flex items-center justify-center ${className}`}
      onClick={handleOAuthClick}
      disabled={isLoading}
    >
      {icon}
      {isLoading ? `Connecting to ${name}...` : `Connect to ${name}`}
    </Button>
  );
};

export default OAuthPopup;