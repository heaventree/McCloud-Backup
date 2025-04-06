import { useState } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Download, FileDown, Github, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function Plugins() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("wordpress");
  const [downloadStarted, setDownloadStarted] = useState<string | null>(null);

  const handleDownload = (pluginId: string, pluginName: string) => {
    setDownloadStarted(pluginId);
    
    if (pluginId === 'wp-backupsheep') {
      // Create an invisible anchor element to download the file
      const link = document.createElement('a');
      link.href = '/api/plugins/wordpress';
      link.setAttribute('download', 'backupsheep.1.8.zip');
      document.body.appendChild(link);
      
      // Start the download
      link.click();
      
      // Clean up
      document.body.removeChild(link);
      
      // Show toast after a brief delay to simulate the download completion
      setTimeout(() => {
        setDownloadStarted(null);
        
        toast({
          title: "Download Complete",
          description: `${pluginName} has been downloaded successfully.`,
          variant: "default",
        });
      }, 2000);
    } else {
      // For other plugin types, just show a simulation
      setTimeout(() => {
        setDownloadStarted(null);
        
        toast({
          title: "Download Complete",
          description: `${pluginName} has been downloaded successfully.`,
          variant: "default",
        });
      }, 2000);
    }
  };

  return (
    <div className="container mx-auto py-6 max-w-7xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Plugins</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Download official BackupSheep plugins for various platforms</p>
        </div>
      </div>

      <Alert className="mb-8 bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800">
        <AlertCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <AlertTitle className="text-blue-800 dark:text-blue-300 font-medium">Plugin Installation</AlertTitle>
        <AlertDescription className="text-blue-700 dark:text-blue-300">
          Download the appropriate plugin for your platform, then follow the installation instructions specific to your CMS.
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="wordpress" value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6 bg-gray-100 dark:bg-gray-800 p-1">
          <TabsTrigger value="wordpress" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
            WordPress
          </TabsTrigger>
          <TabsTrigger value="upcoming" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700">
            Upcoming Plugins
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="wordpress" className="mt-0">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="flex flex-col h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">BackupSheep for WordPress</CardTitle>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                    Latest: v1.8
                  </Badge>
                </div>
                <CardDescription>
                  Official WordPress plugin for BackupSheep with full integration support
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow">
                <div className="space-y-4">
                  <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                    <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Key Features</h4>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 text-sm space-y-1">
                      <li>Automated regular or incremental backups</li>
                      <li>File and database backup support</li>
                      <li>Integration with cloud storage providers</li>
                      <li>Customizable backup schedules</li>
                      <li>Backup encryption for enhanced security</li>
                      <li>WordPress multisite compatibility</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Requirements</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-300">
                      WordPress 5.0+, PHP 7.4+, and a BackupSheep account
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter className="flex justify-between items-center border-t pt-6 mt-auto">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  Updated: April 1, 2025
                </div>
                <Button 
                  onClick={() => handleDownload('wp-backupsheep', 'BackupSheep for WordPress')}
                  disabled={downloadStarted === 'wp-backupsheep'}
                >
                  {downloadStarted === 'wp-backupsheep' ? 
                    'Downloading...' : 
                    <>
                      <Download className="mr-2 h-4 w-4" />
                      Download Plugin
                    </>
                  }
                </Button>
              </CardFooter>
            </Card>

            <Card className="flex flex-col h-full">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-xl">Development Resources</CardTitle>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800">
                    Resources
                  </Badge>
                </div>
                <CardDescription>
                  Developer resources and documentation for BackupSheep integration
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-grow space-y-4">
                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-white">Documentation</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    Comprehensive documentation for developers including API references, sample code, and integration guides.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => window.open('https://backupsheep.com/docs', '_blank')}>
                    <FileDown className="mr-2 h-4 w-4" />
                    View Documentation
                  </Button>
                </div>

                <div className="rounded-lg bg-gray-50 dark:bg-gray-800 p-4">
                  <h4 className="font-medium mb-2 text-gray-900 dark:text-white">GitHub Repository</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                    Access our open-source components, report issues, and contribute to the project on GitHub.
                  </p>
                  <Button variant="outline" className="w-full" onClick={() => window.open('https://github.com/backupsheep/wordpress-plugin', '_blank')}>
                    <Github className="mr-2 h-4 w-4" />
                    Visit GitHub
                  </Button>
                </div>
              </CardContent>
              <CardFooter className="border-t pt-6 mt-auto">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Need custom integration help? Contact our support team for assistance.
                </p>
              </CardFooter>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="upcoming" className="mt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                name: "Shopify App",
                description: "Seamless backup integration for Shopify stores",
                status: "Coming Soon",
                features: ["Product backups", "Order history", "Customer data protection", "Theme backups"]
              },
              {
                name: "Magento Extension",
                description: "Enterprise-grade backup solution for Magento e-commerce",
                status: "In Development",
                features: ["Full store backups", "Incremental updates", "Catalog & inventory", "Multi-store support"]
              },
              {
                name: "WooCommerce Add-on",
                description: "Enhanced backup features specifically for WooCommerce",
                status: "Coming Soon",
                features: ["Order database backups", "Product catalog protection", "Customer data safeguards", "Payment integration backups"]
              }
            ].map((plugin, index) => (
              <Card key={index} className="bg-gray-50/50 dark:bg-gray-800/50 border-dashed flex flex-col h-full">
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg">{plugin.name}</CardTitle>
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800">
                      {plugin.status}
                    </Badge>
                  </div>
                  <CardDescription>
                    {plugin.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-grow">
                  <div className="space-y-2">
                    <h4 className="font-medium text-sm text-gray-900 dark:text-white">Planned Features</h4>
                    <ul className="list-disc list-inside text-gray-600 dark:text-gray-300 text-sm space-y-1">
                      {plugin.features.map((feature, i) => (
                        <li key={i}>{feature}</li>
                      ))}
                    </ul>
                  </div>
                </CardContent>
                <CardFooter className="border-t pt-4 mt-auto">
                  <Button variant="outline" className="w-full" disabled>
                    <AlertCircle className="mr-2 h-4 w-4" />
                    Get Notified on Release
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}