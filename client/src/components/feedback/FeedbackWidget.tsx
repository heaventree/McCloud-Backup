import React, { useState, useEffect, useRef } from 'react';
import { X, MessageSquare, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';

interface Position {
  x: number;
  y: number;
}

interface FeedbackItem {
  id: string;
  x: number;
  y: number;
  comment: string;
  pagePath: string;
  status: 'open' | 'in-progress' | 'completed';
  createdAt: string;
}

interface FeedbackWidgetProps {
  enabled: boolean;
  onClose?: () => void;
  projectId?: string;
  pagePath?: string;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  enabled,
  onClose,
  projectId = 'default',
  pagePath = window.location.pathname
}) => {
  const [active, setActive] = useState<boolean>(false);
  const [position, setPosition] = useState<Position>({ x: 0, y: 0 });
  const [comment, setComment] = useState<string>('');
  const [feedbackMode, setFeedbackMode] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [feedbackSuccess, setFeedbackSuccess] = useState<boolean>(false);

  const widgetRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    setActive(enabled);
    
    // Cleanup feedback mode when widget is disabled
    if (!enabled) {
      setFeedbackMode(false);
    }
  }, [enabled]);

  useEffect(() => {
    if (!active) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(e.target as Node) && !feedbackMode) {
        // Only set position when clicking on elements not in the feedback widget
        setPosition({ x: e.clientX, y: e.clientY });
        setFeedbackMode(true);
      }
    };

    document.addEventListener('click', handleClickOutside);

    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, [active, feedbackMode]);

  const handleClose = () => {
    setFeedbackMode(false);
    setComment('');
    setFeedbackSuccess(false);
    if (onClose) onClose();
  };

  const handleSubmit = async () => {
    if (!comment.trim()) {
      toast({
        title: "Comment required",
        description: "Please enter a comment before submitting feedback",
        variant: "destructive"
      });
      return;
    }

    setSubmitting(true);

    try {
      // Convert viewport coordinates to percentages for responsive positioning
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      
      const relativeX = (position.x / viewportWidth) * 100;
      const relativeY = (position.y / viewportHeight) * 100;

      // Submit feedback to API
      await apiRequest("POST", "/api/feedback", {
        x: relativeX,
        y: relativeY,
        comment,
        projectId,
        pagePath,
        timestamp: new Date().toISOString(),
        status: "open" // Initial status
      });

      // Show success message
      setFeedbackSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/feedback"] });
      
      setTimeout(() => {
        setFeedbackMode(false);
        setComment('');
        setFeedbackSuccess(false);
      }, 1500);

      toast({
        title: "Feedback submitted",
        description: "Your feedback has been recorded successfully"
      });
    } catch (error) {
      toast({
        title: "Error submitting feedback",
        description: "There was a problem saving your feedback. Please try again.",
        variant: "destructive"
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!active) return null;

  return (
    <>
      {/* Floating action button when not in feedback mode */}
      {!feedbackMode && (
        <div className="fixed bottom-4 right-4 z-50">
          <Button 
            className="rounded-full h-14 w-14 shadow-lg bg-blue-600 hover:bg-blue-700 text-white p-0 flex items-center justify-center"
            onClick={() => setFeedbackMode(true)}
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        </div>
      )}

      {/* Feedback form when in feedback mode */}
      {feedbackMode && (
        <div
          ref={widgetRef}
          className="fixed z-50 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 w-80"
          style={{
            left: `${Math.min(position.x, window.innerWidth - 320)}px`,
            top: `${Math.min(position.y, window.innerHeight - 200)}px`,
          }}
        >
          <div className="p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-md font-medium text-gray-900 dark:text-gray-100">
                Leave Feedback
              </h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-8 w-8 p-0 rounded-full" 
                onClick={handleClose}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
            
            {feedbackSuccess ? (
              <div className="flex flex-col items-center justify-center py-4">
                <div className="bg-green-100 dark:bg-green-900/30 rounded-full p-3 mb-2">
                  <Check className="h-6 w-6 text-green-600 dark:text-green-400" />
                </div>
                <p className="text-center text-gray-600 dark:text-gray-300">
                  Thank you for your feedback!
                </p>
              </div>
            ) : (
              <>
                <Textarea
                  className="w-full mb-3 resize-none h-24"
                  placeholder="What do you think about this page or feature?"
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                />
                
                <div className="flex justify-end">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="mr-2" 
                    onClick={handleClose}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm" 
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="bg-blue-600 text-white hover:bg-blue-700"
                  >
                    {submitting ? 'Submitting...' : 'Submit Feedback'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
      
      {/* Visual indicator that feedback mode is active */}
      {active && !feedbackMode && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-3 py-1 rounded-full z-50 text-sm font-medium flex items-center">
          <MessageSquare className="h-4 w-4 mr-1" />
          Feedback Mode Active
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;