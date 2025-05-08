import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Database, CheckCircle, XCircle, RefreshCw } from "lucide-react";
import { apiRequest } from '@/lib/queryClient';

// Format file size in bytes to human-readable format
const formatBytes = (bytes: number | null) => {
  if (bytes === null) return 'Unknown';
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

interface DatabaseStatusProps {
  className?: string;
}

interface DatabaseStatusResponse {
  status: string;
  connectionInfo: {
    type: string;
    host: string;
    database: string;
    connected: boolean;
  };
  stats: {
    tables: number;
    size: number | null;
    type: string;
    version: string | null;
  };
}

export function DatabaseStatusCard({ className }: DatabaseStatusProps) {
  const { toast } = useToast();
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  
  const { data, isLoading, error, refetch } = useQuery<DatabaseStatusResponse>({
    queryKey: ['/api/database/status'],
    refetchInterval: false,
    refetchOnWindowFocus: false,
    select: (data) => data as DatabaseStatusResponse,
  });
  
  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      setIsTestingConnection(true);
      // Use fetch directly instead of apiRequest which is designed for POST/PUT requests
      const response = await fetch('/api/database/status');
      const data = await response.json();
      return data as DatabaseStatusResponse;
    },
    onSuccess: (data) => {
      toast({
        title: data.connectionInfo.connected ? "Connection successful" : "Connection failed",
        description: data.connectionInfo.connected 
          ? `Connected to ${data.connectionInfo.type} database.` 
          : "Could not connect to database. Please check your configuration.",
        variant: data.connectionInfo.connected ? "default" : "destructive",
      });
      refetch();
    },
    onError: () => {
      toast({
        title: "Connection test failed",
        description: "An error occurred while testing the database connection.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setIsTestingConnection(false);
    }
  });
  
  const handleTestConnection = () => {
    testConnectionMutation.mutate();
  };
  
  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="mr-2 h-5 w-5" />
            Database Connection
          </CardTitle>
          <CardDescription>Database connection settings and status</CardDescription>
        </CardHeader>
        <CardContent className="flex justify-center items-center py-10">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }
  
  if (error || !data) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Database className="mr-2 h-5 w-5" />
            Database Connection
          </CardTitle>
          <CardDescription>Database connection settings and status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            <div className="flex items-center">
              <XCircle className="h-5 w-5 text-red-500 mr-2" />
              <span>Error loading database information</span>
            </div>
            <p className="text-sm text-muted-foreground">
              {error instanceof Error ? error.message : "Unknown error"}
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  const { connectionInfo, stats } = data;
  
  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="flex items-center">
              <Database className="mr-2 h-5 w-5" />
              Database Connection
            </CardTitle>
            <CardDescription>Database connection settings and status</CardDescription>
          </div>
          <Badge 
            variant={connectionInfo.connected ? "outline" : "destructive"}
            className={connectionInfo.connected ? "bg-green-100 text-green-800 hover:bg-green-100" : ""}
          >
            {connectionInfo.connected ? "Connected" : "Disconnected"}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="space-y-3">
            <h3 className="text-sm font-medium">Connection Information</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Type:</div>
              <div className="font-medium">{connectionInfo.type}</div>
              
              <div className="text-muted-foreground">Host:</div>
              <div className="font-medium">{connectionInfo.host}</div>
              
              <div className="text-muted-foreground">Database:</div>
              <div className="font-medium">{connectionInfo.database}</div>
              
              <div className="text-muted-foreground">Status:</div>
              <div className="font-medium flex items-center">
                {connectionInfo.connected ? (
                  <>
                    <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                    Connected
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-red-500 mr-1" />
                    Disconnected
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-medium">Database Statistics</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="text-muted-foreground">Database Type:</div>
              <div className="font-medium">{stats.type}</div>
              
              <div className="text-muted-foreground">Version:</div>
              <div className="font-medium">{stats.version || "Unknown"}</div>
              
              <div className="text-muted-foreground">Tables:</div>
              <div className="font-medium">{stats.tables}</div>
              
              <div className="text-muted-foreground">Size:</div>
              <div className="font-medium">{formatBytes(stats.size)}</div>
            </div>
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button onClick={handleTestConnection} disabled={isTestingConnection}>
          {isTestingConnection ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Test Connection
            </>
          )}
        </Button>
        <Button variant="outline" onClick={() => refetch()}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </CardFooter>
    </Card>
  );
}