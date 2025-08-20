import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Download, FileArchive, Clock } from 'lucide-react';

interface DownloadConfirmDialogProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  filename: string;
  fileSize: number;
  siteName: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

const formatBytes = (bytes: number, isCalculating: boolean = false): string => {
  if (isCalculating) return 'Calculating...';
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const estimateDownloadTime = (bytes: number, isCalculating: boolean = false): string => {
  if (isCalculating) return 'Calculating...';
  if (bytes === 0) return 'Unknown';
  
  // Estimate based on typical broadband speeds (10 Mbps = 1.25 MB/s)
  const bytesPerSecond = 1.25 * 1024 * 1024; // 1.25 MB/s
  const seconds = bytes / bytesPerSecond;
  
  if (seconds < 5) return 'a few seconds';
  if (seconds < 60) return `~${Math.round(seconds)} seconds`;
  if (seconds < 300) return `~${Math.round(seconds / 60)} minutes`;
  return `~${Math.round(seconds / 60)} minutes`;
};

export function DownloadConfirmDialog({
  isOpen,
  onOpenChange,
  filename,
  fileSize,
  siteName,
  onConfirm,
  isLoading = false
}: DownloadConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center">
            <Download className="h-5 w-5 mr-2 text-blue-600 dark:text-blue-400" />
            Download Backup
          </DialogTitle>
          <DialogDescription>
            Ready to download backup for <strong>{siteName}</strong>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center space-x-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <FileArchive className="h-8 w-8 text-gray-600 dark:text-gray-400" />
            <div className="flex-1">
              <div className="font-medium text-gray-900 dark:text-gray-100 truncate" title={filename}>
                {filename}
              </div>
              <div className="text-sm text-gray-500 dark:text-gray-400">
                {formatBytes(fileSize, isLoading)}
              </div>
            </div>
          </div>

          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4 mr-2" />
            Estimated download time: {estimateDownloadTime(fileSize, isLoading)}
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
            <strong>Note:</strong> Download progress will be shown in the bottom-right corner. 
            You can minimize the progress indicator and continue using the application while downloading.
          </div>
        </div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Calculating Size...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Download
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}