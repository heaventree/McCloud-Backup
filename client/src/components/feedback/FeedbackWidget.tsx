import React, { useEffect, useState } from 'react';
import { MessageSquare, X, Check } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Feedback } from '@shared/schema';

interface FeedbackWidgetProps {
  projectId?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  darkMode?: boolean;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  projectId = 'default',
  position = 'bottom-right',
  darkMode = false,
}) => {
  const [feedbackMode, setFeedbackMode] = useState(false);
  const [feedbackPosition, setFeedbackPosition] = useState({ x: 0, y: 0 });
  const [showForm, setShowForm] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Set button position based on prop
  const getButtonPosition = () => {
    switch (position) {
      case 'bottom-left':
        return 'bottom-5 left-5';
      case 'top-right':
        return 'top-5 right-5';
      case 'top-left':
        return 'top-5 left-5';
      case 'bottom-right':
      default:
        return 'bottom-5 right-5';
    }
  };

  // Initialize widget and handle cleanup
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setFeedbackMode(false);
        setShowForm(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Toggle feedback mode
  const toggleFeedbackMode = () => {
    setFeedbackMode(!feedbackMode);
    setShowForm(false);
  };

  // Handle click on page to place feedback
  const handlePageClick = (e: React.MouseEvent) => {
    if (!feedbackMode) return;

    // Don't show form when clicking on feedback elements
    if (
      (e.target as HTMLElement).closest('.feedback-widget') ||
      (e.target as HTMLElement).closest('.feedback-form') ||
      (e.target as HTMLElement).closest('.feedback-indicator')
    ) {
      return;
    }

    // Calculate position as percentage of viewport
    const relativeX = (e.clientX / window.innerWidth) * 100;
    const relativeY = (e.clientY / window.innerHeight) * 100;
    
    setFeedbackPosition({ x: e.clientX, y: e.clientY });
    setShowForm(true);
  };

  // Submit feedback
  const submitFeedback = async () => {
    if (!comment.trim()) return;
    
    setSubmitting(true);
    
    // Calculate position as percentage of viewport
    const relativeX = (feedbackPosition.x / window.innerWidth) * 100;
    const relativeY = (feedbackPosition.y / window.innerHeight) * 100;
    
    try {
      await apiRequest<Feedback>('POST', '/api/feedback', {
        projectId,
        pagePath: window.location.pathname,
        x: relativeX,
        y: relativeY,
        comment: comment.trim(),
        status: 'open',
        priority: 'medium'
      });
      
      setSuccess(true);
      setComment('');
      
      // Auto close after delay
      setTimeout(() => {
        setShowForm(false);
        setFeedbackMode(false);
        setSuccess(false);
      }, 1500);
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Click handler overlay */}
      {feedbackMode && (
        <div 
          className="fixed inset-0 z-[9990] cursor-crosshair" 
          onClick={handlePageClick}
        >
          <div className="fixed top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full z-[9991] flex items-center gap-2">
            <MessageSquare className="h-4 w-4" />
            <span className="text-sm font-medium">Feedback Mode Active</span>
          </div>
        </div>
      )}

      {/* Feedback Button */}
      {!feedbackMode && (
        <button
          className={`fixed ${getButtonPosition()} z-[9990] w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200`}
          onClick={toggleFeedbackMode}
          aria-label="Leave feedback"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {/* Feedback Form */}
      {showForm && (
        <div 
          className={`fixed z-[9991] w-[320px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg overflow-hidden`}
          style={{
            left: `${Math.min(feedbackPosition.x, window.innerWidth - 340)}px`,
            top: `${Math.min(feedbackPosition.y, window.innerHeight - 200)}px`
          }}
        >
          <div className="border-b border-gray-200 dark:border-gray-700 py-2 px-4 flex justify-between items-center">
            <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100">Leave Feedback</h3>
            <button 
              onClick={() => setShowForm(false)} 
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          
          {success ? (
            <div className="p-4 flex flex-col items-center text-center">
              <div className="w-10 h-10 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-2">
                <Check className="h-5 w-5" />
              </div>
              <p className="text-sm text-gray-900 dark:text-gray-100">Thank you for your feedback!</p>
            </div>
          ) : (
            <div className="p-4">
              <textarea
                className="w-full p-2 text-sm border border-gray-200 dark:border-gray-700 rounded-md bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 mb-3"
                placeholder="What do you think about this page or feature?"
                rows={4}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md"
                >
                  Cancel
                </button>
                <button
                  onClick={submitFeedback}
                  disabled={!comment.trim() || submitting}
                  className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Submitting...' : 'Submit Feedback'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;