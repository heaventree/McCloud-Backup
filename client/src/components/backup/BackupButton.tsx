import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Archive, AlertCircle, Loader2, AlertTriangle } from 'lucide-react';
import { usePluginHealthCheck } from '@/hooks/use-plugin-health';
import { Site } from '@/lib/types';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface BackupButtonProps {
  site: Site;
  onStartBackup: (site: Site) => void;
  className?: string;
}

export default function BackupButton({ site, onStartBackup, className }: BackupButtonProps) {
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);
  const { isPluginReady, isPluginAvailable, pluginStatus, errorMessage, isChecking } = usePluginHealthCheck(site.id);

  const handleBackupClick = async () => {
    if (!isPluginReady && !isCheckingHealth) {
      // Trigger a health check if we haven't done one recently
      setIsCheckingHealth(true);
      // The health check query will automatically run
      setTimeout(() => setIsCheckingHealth(false), 2000);
      return;
    }

    if (isPluginReady) {
      onStartBackup(site);
    }
  };

  const getButtonState = () => {
    if (isChecking || isCheckingHealth) {
      return {
        disabled: true,
        variant: 'secondary' as const,
        icon: <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin sm:h-4 sm:w-4" />,
        text: 'Checking Plugin...',
        tooltip: 'Checking if the WordPress plugin is installed and active...',
        className: 'bg-gray-500 text-white'
      };
    }

    if (!isPluginAvailable) {
      return {
        disabled: false, // Allow click to trigger check
        variant: 'destructive' as const,
        icon: <AlertCircle className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />,
        text: 'Plugin Required',
        tooltip: `Plugin not available: ${errorMessage || 'Unknown error'}. Click to recheck.`,
        className: 'bg-red-600 hover:bg-red-700 text-white'
      };
    }

    if (isPluginAvailable && !isPluginReady) {
      return {
        disabled: false, // Allow click to trigger check
        variant: 'secondary' as const,
        icon: <AlertTriangle className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />,
        text: 'Plugin Issue',
        tooltip: `Plugin installed but not ready: ${errorMessage || 'Unknown error'}. Click to recheck.`,
        className: 'bg-yellow-600 hover:bg-yellow-700 text-white'
      };
    }

    // Plugin is ready
    return {
      disabled: false,
      variant: 'default' as const,
      icon: <Archive className="h-3 w-3 flex-shrink-0 sm:h-4 sm:w-4" />,
      text: 'One-Click Backup',
      tooltip: 'Plugin is ready. Start backup now.',
      className: 'bg-purple-600 bg-gradient-to-br from-indigo-500 to-purple-600 hover:bg-purple-700 text-white'
    };
  };

  const buttonState = getButtonState();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            onClick={handleBackupClick}
            disabled={buttonState.disabled}
            className={cn(
              'flex flex-1 items-center justify-center space-x-1.5 rounded-md py-2 text-xs font-medium transition-colors sm:space-x-2 sm:py-2.5 sm:text-sm lg:py-3 lg:text-base',
              buttonState.className,
              className
            )}
          >
            {buttonState.icon}
            <span className="whitespace-nowrap">{buttonState.text}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-sm">{buttonState.tooltip}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}