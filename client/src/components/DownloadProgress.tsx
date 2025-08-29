import React from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { X, Minimize2, Download, Loader2 } from 'lucide-react';

interface DownloadProgressProps {
  isVisible: boolean;
  downloadedBytes: number;
  filename: string;
  isCompleted: boolean;
  onCancel: () => void;
  onMinimize: () => void;
  onClose: () => void;
}

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};


export function DownloadProgress({ 
  isVisible, 
  downloadedBytes, 
  filename,
  isCompleted,
  onCancel, 
  onMinimize, 
  onClose 
}: DownloadProgressProps) {
  const [isMinimized, setIsMinimized] = React.useState(false);

  if (!isVisible) return null;

  const handleMinimize = () => {
    setIsMinimized(!isMinimized);
    onMinimize();
  };

  if (isMinimized) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          variant="outline"
          size="sm"
          onClick={handleMinimize}
          className="bg-white dark:bg-gray-800 shadow-lg border"
        >
          {isCompleted ? (
            <Download className="h-4 w-4 mr-2" />
          ) : (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          )}
          {isCompleted ? 'Done' : 'Downloading...'}
        </Button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80">
      <Card className="p-4 shadow-lg bg-white dark:bg-gray-800 border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center">
            <Download className="h-4 w-4 mr-2 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
              {isCompleted ? 'Download Complete' : 'Downloading...'}
            </span>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleMinimize}
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <Minimize2 className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-6 w-6 p-0 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>

        <div className="mb-2">
          <div className="text-xs text-gray-600 dark:text-gray-400 truncate" title={filename}>
            {filename}
          </div>
        </div>

        <div className="mb-3">
          {!isCompleted ? (
            <div className="flex items-center justify-center py-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600 dark:text-blue-400" />
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">Downloading...</span>
            </div>
          ) : (
            <div className="flex items-center justify-center py-2">
              <Download className="h-6 w-6 text-green-600 dark:text-green-400" />
              <span className="ml-2 text-sm text-green-600 dark:text-green-400">Complete</span>
            </div>
          )}
          <div className="text-center text-xs text-gray-500 dark:text-gray-400 mt-1">
            <span>{formatBytes(downloadedBytes)} downloaded</span>
          </div>
        </div>

        {!isCompleted && (
          <div className="flex justify-center">
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="h-7 text-xs"
            >
              Cancel
            </Button>
          </div>
        )}

        {isCompleted && (
          <div className="text-xs text-green-600 dark:text-green-400 text-center">
            File saved successfully
          </div>
        )}
      </Card>
    </div>
  );
}