import { useEffect, useState } from "react";

/**
 * AuthRelay - A simple page that receives token data from URL parameters
 * and relays it to the parent window, then closes itself.
 * 
 * This is a dedicated page for handling OAuth token relay without complex logic.
 */
export default function AuthRelay() {
  const [status, setStatus] = useState("Relaying authentication data...");

  useEffect(() => {
    try {
      // Get all URL parameters
      const params = new URLSearchParams(window.location.search);
      const tokenData = params.get("token_data");
      const provider = params.get("provider") || "dropbox";
      const error = params.get("error");

      // Log available parameters (without showing actual token values)
      console.log("Auth relay received parameters:", {
        hasTokenData: !!tokenData,
        provider,
        hasError: !!error
      });

      // Handle error case
      if (error) {
        console.error("Authentication error:", error);
        setStatus(`Authentication failed: ${error}`);
        // Try to communicate the error back to the parent window
        if (window.opener) {
          window.opener.postMessage({
            type: "OAUTH_ERROR",
            provider,
            error
          }, window.location.origin);
          
          // Close this window after a short delay
          setTimeout(() => {
            try {
              window.close();
            } catch (e) {
              console.warn("Could not close window automatically:", e);
              setStatus("Authentication failed. Please close this window manually.");
            }
          }, 1500);
        }
        return;
      }

      // Handle case with no token data
      if (!tokenData) {
        console.error("No token data received");
        setStatus("No authentication data received");
        return;
      }

      // If we have token data and a parent window, relay it
      if (tokenData && window.opener) {
        console.log("Sending token data to parent window");
        
        // Send the token data to the parent window
        window.opener.postMessage({
          type: "OAUTH_RELAY",
          provider,
          tokenData
        }, window.location.origin);

        setStatus("Authentication successful! Closing window...");
        
        // Close this window after a short delay
        setTimeout(() => {
          try {
            window.close();
          } catch (e) {
            console.warn("Could not close window automatically:", e);
            setStatus("Authentication complete. Please close this window manually.");
          }
        }, 1000);
      } else if (!window.opener) {
        console.warn("No parent window found for token relay");
        setStatus("No parent window found. Please close this window manually.");
      }
    } catch (error) {
      console.error("Error in auth relay:", error);
      setStatus(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="text-center max-w-md p-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-xl font-semibold mb-4">Authentication Relay</h1>
        <p className="mb-4 text-muted-foreground">{status}</p>
        <button 
          onClick={() => window.close()} 
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Close Window
        </button>
      </div>
    </div>
  );
}