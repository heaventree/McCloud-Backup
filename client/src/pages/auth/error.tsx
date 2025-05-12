import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useLocation } from "wouter";

/**
 * Error page for OAuth authentication failures
 * Shows user-friendly error messages and allows retrying
 */
export default function AuthError() {
  const [, setLocation] = useLocation();
  
  // Extract error from URL parameters
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error') || 'Unknown error';
  
  // Map error codes to user-friendly messages
  const getErrorMessage = (errorCode: string): string => {
    const errorMessages: Record<string, string> = {
      'missing_parameters': 'Authentication parameters are missing. Please try again.',
      'invalid_state': 'Authentication session expired or is invalid. Please try again.',
      'access_denied': 'Access was denied to your account. Please try again and approve the requested permissions.',
      'authentication_failed': 'Authentication failed. Please check your account and try again.',
      'missing_credentials': 'Server configuration issue: OAuth credentials are missing.',
      'token_exchange_failed': 'Could not exchange authorization code for token. Please try again.'
    };
    
    return errorMessages[errorCode] || `Authentication error: ${errorCode}`;
  };
  
  // Get user-friendly error message
  const errorMessage = getErrorMessage(error);
  
  return (
    <div className="flex min-h-screen items-center justify-center p-4 bg-gray-50 dark:bg-gray-900">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader>
          <CardTitle className="text-xl">Authentication Error</CardTitle>
          <CardDescription>
            There was a problem with your authentication request.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive" className="mb-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>
              {errorMessage}
            </AlertDescription>
          </Alert>
          
          <div className="text-sm text-muted-foreground mt-4">
            <p className="mb-2">Possible solutions:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Make sure you're using the latest version of your browser</li>
              <li>Clear your browser cookies and try again</li>
              <li>Check that your account has the necessary permissions</li>
              <li>If the problem persists, contact support</li>
            </ul>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => window.close()}>
            Close
          </Button>
          <Button onClick={() => setLocation('/storage-providers')}>
            Return to Storage Providers
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}