import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Activity, 
  AlertCircle, 
  CheckCircle, 
  ChevronRight, 
  Database, 
  FileText, 
  Loader2, 
  Server, 
  Settings, 
  Shield, 
  Zap
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Site, HealthCheckResult } from "@/lib/types";
import { useQuery } from "@tanstack/react-query";

interface HealthCheckCardProps {
  site: Site;
}

const HealthCheckCard = ({ site }: HealthCheckCardProps) => {
  const [isHealthDialogOpen, setIsHealthDialogOpen] = useState(false);
  const [isRunningCheck, setIsRunningCheck] = useState(false);
  
  // Query for health check data
  const { 
    data: healthData, 
    isLoading, 
    isError, 
    refetch 
  } = useQuery<HealthCheckResult>({ 
    queryKey: [`/api/sites/${site.id}/health-check`],
    enabled: false, // Don't run automatically
  });
  
  // Function to run the health check
  const runHealthCheck = async () => {
    setIsRunningCheck(true);
    try {
      await refetch();
      setIsHealthDialogOpen(true);
    } finally {
      setIsRunningCheck(false);
    }
  };
  
  // Get color based on health score
  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-500";
    if (score >= 75) return "text-green-400";
    if (score >= 50) return "text-yellow-500";
    if (score >= 25) return "text-orange-500";
    return "text-red-500";
  };
  
  // Get background color based on health score
  const getScoreBgColor = (score: number) => {
    if (score >= 90) return "bg-green-500";
    if (score >= 75) return "bg-green-400";
    if (score >= 50) return "bg-yellow-500";
    if (score >= 25) return "bg-orange-500";
    return "bg-red-500";
  };
  
  // Get status text
  const getStatusText = (status: string) => {
    switch (status) {
      case "excellent": return "Excellent";
      case "good": return "Good";
      case "fair": return "Fair";
      case "poor": return "Poor";
      case "critical": return "Critical";
      default: return "Unknown";
    }
  };
  
  return (
    <>
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle className="text-md font-medium">Health Check</CardTitle>
          <Activity className="h-4 w-4 text-gray-500" />
        </CardHeader>
        <CardContent>
          <div className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Run a comprehensive health check to identify potential issues with your WordPress site.
          </div>
          
          <Button 
            onClick={runHealthCheck} 
            disabled={isRunningCheck}
            className="w-full"
          >
            {isRunningCheck ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Running...
              </>
            ) : (
              <>
                <Activity className="mr-2 h-4 w-4" />
                Run Health Check
              </>
            )}
          </Button>
          
          {healthData && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Overall Health</span>
                <span className={`font-bold ${getScoreColor(healthData.overall_health.score)}`}>
                  {healthData.overall_health.score}%
                </span>
              </div>
              <Progress 
                value={healthData.overall_health.score} 
                className="h-2"
                indicatorClassName={getScoreBgColor(healthData.overall_health.score)}
              />
              <Button 
                variant="ghost" 
                className="w-full mt-3 flex justify-between items-center"
                onClick={() => setIsHealthDialogOpen(true)}
              >
                <span>View Details</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      
      {/* Health Check Dialog */}
      <Dialog open={isHealthDialogOpen} onOpenChange={setIsHealthDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Activity className="mr-2 h-5 w-5 text-primary" />
              Health Check Results for {site.name}
            </DialogTitle>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center p-6">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : isError ? (
            <div className="text-center text-red-500 p-6">
              Failed to load health check data
            </div>
          ) : healthData ? (
            <div className="space-y-6">
              {/* Summary Card */}
              <div className="bg-card border rounded-lg p-5">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between">
                  <div className="mb-4 md:mb-0">
                    <h3 className="text-lg font-medium mb-1">Overall Health Score</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Last check performed on {new Date(healthData.timestamp).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <div className="w-16 h-16 rounded-full flex items-center justify-center border-4 mr-4"
                      style={{ 
                        borderColor: getScoreBgColor(healthData.overall_health.score),
                        color: getScoreColor(healthData.overall_health.score)
                      }}
                    >
                      <span className="text-xl font-bold">{healthData.overall_health.score}%</span>
                    </div>
                    <div>
                      <div className={`text-lg font-medium ${getScoreColor(healthData.overall_health.score)}`}>
                        {getStatusText(healthData.overall_health.status)}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        Overall Status
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Component Scores Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* WordPress */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-blue-500" />
                        <h3 className="font-medium">WordPress</h3>
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        <span className={getScoreColor(healthData.wordpress.health_score)}>
                          {healthData.wordpress.health_score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        v{healthData.wordpress.version} {healthData.wordpress.is_latest ? "(Latest)" : "(Update Available)"}
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${getScoreBgColor(healthData.wordpress.health_score)} text-white font-medium`}>
                      {getStatusText(healthData.wordpress.status)}
                    </div>
                  </div>
                </div>
                
                {/* PHP */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <Server className="h-5 w-5 mr-2 text-indigo-500" />
                        <h3 className="font-medium">PHP</h3>
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        <span className={getScoreColor(healthData.php.health_score)}>
                          {healthData.php.health_score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        v{healthData.php.version} {healthData.php.is_supported ? "(Supported)" : "(Unsupported)"}
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${getScoreBgColor(healthData.php.health_score)} text-white font-medium`}>
                      {getStatusText(healthData.php.status)}
                    </div>
                  </div>
                </div>
                
                {/* Database */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <Database className="h-5 w-5 mr-2 text-green-500" />
                        <h3 className="font-medium">Database</h3>
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        <span className={getScoreColor(healthData.database.health_score)}>
                          {healthData.database.health_score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {healthData.database.tables_count} tables, {healthData.database.size_formatted}
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${getScoreBgColor(healthData.database.health_score)} text-white font-medium`}>
                      {getStatusText(healthData.database.status)}
                    </div>
                  </div>
                </div>
                
                {/* Server */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <Server className="h-5 w-5 mr-2 text-orange-500" />
                        <h3 className="font-medium">Server</h3>
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        <span className={getScoreColor(healthData.server.health_score)}>
                          {healthData.server.health_score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {healthData.server.host_info.provider}, {healthData.server.os}
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${getScoreBgColor(healthData.server.health_score)} text-white font-medium`}>
                      {getStatusText(healthData.server.status)}
                    </div>
                  </div>
                </div>
                
                {/* Plugins */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <Settings className="h-5 w-5 mr-2 text-purple-500" />
                        <h3 className="font-medium">Plugins</h3>
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        <span className={getScoreColor(healthData.plugins.health_score)}>
                          {healthData.plugins.health_score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {healthData.plugins.active} active, {healthData.plugins.updates_needed} updates needed
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${getScoreBgColor(healthData.plugins.health_score)} text-white font-medium`}>
                      {getStatusText(healthData.plugins.status)}
                    </div>
                  </div>
                </div>
                
                {/* Themes */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <FileText className="h-5 w-5 mr-2 text-yellow-500" />
                        <h3 className="font-medium">Themes</h3>
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        <span className={getScoreColor(healthData.themes.health_score)}>
                          {healthData.themes.health_score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {healthData.themes.active.name}, {healthData.themes.updates_needed} updates needed
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${getScoreBgColor(healthData.themes.health_score)} text-white font-medium`}>
                      {getStatusText(healthData.themes.status)}
                    </div>
                  </div>
                </div>
                
                {/* Security */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <Shield className="h-5 w-5 mr-2 text-red-500" />
                        <h3 className="font-medium">Security</h3>
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        <span className={getScoreColor(healthData.security.health_score)}>
                          {healthData.security.health_score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {healthData.security.vulnerabilities.total} vulnerabilities found
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${getScoreBgColor(healthData.security.health_score)} text-white font-medium`}>
                      {getStatusText(healthData.security.status)}
                    </div>
                  </div>
                </div>
                
                {/* Performance */}
                <div className="bg-card border rounded-lg p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center">
                        <Zap className="h-5 w-5 mr-2 text-amber-500" />
                        <h3 className="font-medium">Performance</h3>
                      </div>
                      <div className="mt-1 text-2xl font-bold">
                        <span className={getScoreColor(healthData.performance.health_score)}>
                          {healthData.performance.health_score}%
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        {healthData.performance.cache.object_cache ? "Object cache enabled" : "No object cache"}
                      </div>
                    </div>
                    <div className={`px-2 py-1 text-xs rounded ${getScoreBgColor(healthData.performance.health_score)} text-white font-medium`}>
                      {getStatusText(healthData.performance.status)}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* Issues and Recommendations Section */}
              <div className="border rounded-lg">
                <div className="p-4 border-b font-medium flex items-center">
                  <AlertCircle className="h-5 w-5 mr-2 text-amber-500" />
                  Recommendations
                </div>
                <div className="p-4">
                  <ul className="space-y-3">
                    {/* WordPress */}
                    {healthData.wordpress.updates.plugins.length > 0 && (
                      <li className="flex items-start">
                        <div className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-amber-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <strong>Update WordPress plugins</strong>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {healthData.wordpress.updates.plugins.length} plugin(s) have updates available. Keeping plugins updated helps improve security and performance.
                          </div>
                        </div>
                      </li>
                    )}
                    
                    {/* PHP */}
                    {!healthData.php.is_supported && (
                      <li className="flex items-start">
                        <div className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-red-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <strong>Update PHP version</strong>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            PHP version {healthData.php.version} is no longer supported. Upgrade to at least version {healthData.php.recommended_version} for better security and performance.
                          </div>
                        </div>
                      </li>
                    )}
                    
                    {/* Database */}
                    {healthData.database.autoload_size > 1 * 1024 * 1024 && (
                      <li className="flex items-start">
                        <div className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-amber-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <strong>Optimize database autoload data</strong>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Your site has a large amount of autoloaded data ({Math.round(healthData.database.autoload_size / 1024)} KB), which can slow down every page load.
                          </div>
                        </div>
                      </li>
                    )}
                    
                    {/* Plugins */}
                    {healthData.plugins.unoptimized.length > 0 && (
                      <li className="flex items-start">
                        <div className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-amber-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <strong>Review resource-intensive plugins</strong>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {healthData.plugins.unoptimized.length} plugin(s) may be negatively impacting your site's performance:
                            <ul className="list-disc ml-5 mt-1">
                              {healthData.plugins.unoptimized.map((plugin, index) => (
                                <li key={index}>
                                  {plugin.name} - {plugin.reason}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      </li>
                    )}
                    
                    {/* Performance */}
                    {!healthData.performance.cache.object_cache && (
                      <li className="flex items-start">
                        <div className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-amber-500">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <strong>Enable object caching</strong>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            Object caching can significantly improve your site's performance by reducing database queries.
                          </div>
                        </div>
                      </li>
                    )}
                    
                    {/* Check if no recommendations */}
                    {healthData.wordpress.updates.plugins.length === 0 && 
                    healthData.php.is_supported &&
                    healthData.database.autoload_size <= 1 * 1024 * 1024 &&
                    healthData.plugins.unoptimized.length === 0 &&
                    healthData.performance.cache.object_cache && (
                      <li className="flex items-start">
                        <div className="mt-0.5 mr-3 h-5 w-5 flex-shrink-0 text-green-500">
                          <CheckCircle className="h-5 w-5" />
                        </div>
                        <div>
                          <strong>Great job!</strong>
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            No critical issues found. Your site is well-optimized!
                          </div>
                        </div>
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default HealthCheckCard;