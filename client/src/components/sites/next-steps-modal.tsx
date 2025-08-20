import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Copy,
  Download,
  HelpCircle,
  Key,
  Globe,
  CheckCircle2,
  Loader2,
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { Site } from '@/lib/types';

interface NextStepsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  site: Site | null;
}

export default function NextStepsModal({ open, onOpenChange, site }: NextStepsModalProps) {
  const { toast } = useToast();
  const [downloadStarted, setDownloadStarted] = useState(false);

  // Helper function to get webhook URL
  const getWebhookUrl = () => {
    const currentUrl = window.location.origin;
    return `${currentUrl}`;
  };

  // Helper function to copy text to clipboard
  const copyToClipboard = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: 'Copied!',
        description: `${label} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: 'Copy failed',
        description: `Could not copy ${label} to clipboard`,
        variant: 'destructive',
      });
    }
  };

  // Handle plugin download
  const handleDownload = () => {
    setDownloadStarted(true);
    
    // Create an invisible anchor element to download the file
    const link = document.createElement('a');
    link.href = '/api/plugins/wordpress';
    link.setAttribute('download', 'mccloud-backup-plugin.zip');
    document.body.appendChild(link);
    
    // Start the download
    link.click();
    
    // Clean up
    document.body.removeChild(link);
    
    // Show toast after a brief delay to simulate the download completion
    setTimeout(() => {
      setDownloadStarted(false);
      
      toast({
        title: "Download Complete",
        description: "WordPress plugin has been downloaded successfully.",
        variant: "default",
      });
    }, 2000);
  };

  if (!site) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl border-gray-200 bg-white text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-gray-800 dark:text-gray-100 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Site Added Successfully!
          </DialogTitle>
          <DialogDescription className="text-gray-600 dark:text-gray-400">
            Complete these steps to start backing up <strong>{site.name}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Step 1: Download WordPress Plugin */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-sm font-medium">
                1
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Download WordPress Plugin</h3>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-4 w-4 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2 text-sm">
                      <p><strong>Installation Steps:</strong></p>
                      <ol className="list-decimal list-inside space-y-1">
                        <li>Go to your WordPress Admin Dashboard</li>
                        <li>Navigate to Plugins → Add New</li>
                        <li>Click "Upload Plugin"</li>
                        <li>Upload the downloaded ZIP file</li>
                        <li>Click "Install Now" and then "Activate"</li>
                      </ol>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Download and install the McCloud Backup plugin on your WordPress site
            </p>
            <Button 
              onClick={handleDownload}
              disabled={downloadStarted}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {downloadStarted ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="mr-2 h-4 w-4" />
                  Download WordPress Plugin
                </>
              )}
            </Button>
          </div>

          {/* Step 2: Configure Webhook URL */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-sm font-medium">
                2
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Configure Webhook URL</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Copy this webhook URL and paste it into the plugin settings
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
              <Globe className="h-4 w-4 text-purple-500 flex-shrink-0" />
              <code className="flex-1 text-xs sm:text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                {getWebhookUrl()}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(getWebhookUrl(), 'Webhook URL')}
                className="flex-shrink-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Step 3: Configure API Key */}
          <div className="rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex items-center gap-3 mb-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm font-medium">
                3
              </div>
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Configure API Key</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
              Copy this API key and paste it into the plugin settings for authentication
            </p>
            <div className="flex items-center gap-2 p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
              <Key className="h-4 w-4 text-green-500 flex-shrink-0" />
              <code className="flex-1 text-xs sm:text-sm font-mono text-gray-900 dark:text-gray-100 break-all">
                {site.apiKey}
              </code>
              <Button
                variant="outline"
                size="sm"
                onClick={() => copyToClipboard(site.apiKey, 'API Key')}
                className="flex-shrink-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>

          {/* Final Step */}
          <div className="rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 p-4">
            <div className="flex items-center gap-2 text-green-800 dark:text-green-200">
              <CheckCircle2 className="h-5 w-5" />
              <h4 className="font-medium">You're All Set!</h4>
            </div>
            <p className="text-sm text-green-700 dark:text-green-300 mt-1">
              Once you've completed these steps, your WordPress site will be ready for automated backups. 
              You can start your first backup from the Site Management page.
            </p>
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <Button onClick={() => onOpenChange(false)} variant="outline">
            Got it, thanks!
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}