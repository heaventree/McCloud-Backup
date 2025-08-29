import React, { createContext, useContext, useState, useEffect } from 'react';
import { toast } from '@/hooks/use-toast';

interface DownloadState {
  isVisible: boolean;
  downloadedBytes: number;
  filename: string;
  isCompleted: boolean;
  abortController?: AbortController;
}

interface DownloadContextType {
  downloadState: DownloadState;
  startDownload: (filename: string) => AbortController;
  updateProgress: (downloadedBytes: number) => void;
  completeDownload: () => void;
  cancelDownload: () => void;
  minimizeDownload: () => void;
  closeDownload: () => void;
  isDownloading: boolean;
}

const DownloadContext = createContext<DownloadContextType | undefined>(undefined);

export const useDownload = () => {
  const context = useContext(DownloadContext);
  if (!context) {
    throw new Error('useDownload must be used within a DownloadProvider');
  }
  return context;
};

export const DownloadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [downloadState, setDownloadState] = useState<DownloadState>({
    isVisible: false,
    downloadedBytes: 0,
    filename: '',
    isCompleted: false,
  });

  const isDownloading = downloadState.isVisible && !downloadState.isCompleted;

  // Add beforeunload event listener when download is active
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (isDownloading) {
        // Standard message for modern browsers
        const message = 'A download is currently in progress. Leaving this page will cancel the download. Are you sure you want to continue?';
        event.preventDefault();
        event.returnValue = message; // For older browsers
        return message;
      }
    };

    if (isDownloading) {
      window.addEventListener('beforeunload', handleBeforeUnload);
    }

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isDownloading]);

  const startDownload = (filename: string): AbortController => {
    const abortController = new AbortController();
    setDownloadState({
      isVisible: true,
      downloadedBytes: 0,
      filename,
      isCompleted: false,
      abortController,
    });
    return abortController;
  };

  const updateProgress = (downloadedBytes: number) => {
    setDownloadState(prev => ({
      ...prev,
      downloadedBytes,
    }));
  };

  const completeDownload = () => {
    setDownloadState(prev => ({
      ...prev,
      isCompleted: true,
    }));

    // Auto-hide progress after 3 seconds
    setTimeout(() => {
      setDownloadState(prev => ({ ...prev, isVisible: false }));
    }, 3000);
  };

  const cancelDownload = () => {
    if (downloadState.abortController) {
      downloadState.abortController.abort();
    }
    setDownloadState(prev => ({ ...prev, isVisible: false }));
    
    toast({
      title: 'Download cancelled',
      description: 'The download was cancelled by the user.',
      variant: 'default',
    });
  };

  const minimizeDownload = () => {
    // Progress component handles its own minimize state
  };

  const closeDownload = () => {
    setDownloadState(prev => ({ ...prev, isVisible: false }));
  };

  const value: DownloadContextType = {
    downloadState,
    startDownload,
    updateProgress,
    completeDownload,
    cancelDownload,
    minimizeDownload,
    closeDownload,
    isDownloading,
  };

  return (
    <DownloadContext.Provider value={value}>
      {children}
    </DownloadContext.Provider>
  );
};