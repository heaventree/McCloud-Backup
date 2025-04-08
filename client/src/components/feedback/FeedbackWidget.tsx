import React, { useState } from 'react';
import { MessageSquare, Check, Send } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { Feedback } from '@shared/schema';

interface FeedbackWidgetProps {
  projectId?: string;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  projectId = 'default'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  // Toggle feedback form
  const toggleFeedback = () => {
    setIsOpen(!isOpen);
    setSuccess(false);
  };

  // Submit feedback
  const submitFeedback = async () => {
    if (!comment.trim()) return;
    
    setSubmitting(true);
    
    try {
      await apiRequest<Feedback>('POST', '/api/feedback', {
        projectId,
        pagePath: window.location.pathname,
        x: 50, // Center position
        y: 50, // Center position
        comment: comment.trim(),
        status: 'open',
        priority: 'medium'
      });
      
      setSuccess(true);
      setComment('');
      
      // Auto close after delay
      setTimeout(() => {
        setIsOpen(false);
        setSuccess(false);
      }, 2000);
      
    } catch (error) {
      console.error('Error submitting feedback:', error);
      alert('Failed to submit feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Feedback Button */}
      <button
        className="fixed bottom-5 right-5 z-50 w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200"
        onClick={toggleFeedback}
        aria-label="Leave feedback"
      >
        <MessageSquare className="h-5 w-5" />
      </button>

      {/* Feedback Form */}
      {isOpen && (
        <div className="fixed bottom-20 right-5 z-50 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden">
          <div className="px-5 py-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">Share Your Thoughts</h3>
              <button 
                onClick={toggleFeedback}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
            
            {success ? (
              <div className="py-6 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center mb-3">
                  <Check className="h-6 w-6" />
                </div>
                <p className="text-gray-900 dark:text-gray-100">Thank you for your feedback!</p>
              </div>
            ) : (
              <>
                <textarea
                  className="w-full p-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder="What do you think of this page or feature?"
                  rows={4}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  autoFocus
                />
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    Feedback will be visible in the dashboard
                  </div>
                  <button
                    onClick={submitFeedback}
                    disabled={!comment.trim() || submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    {submitting ? 'Sending...' : 'Send'}
                    {!submitting && <Send className="h-4 w-4" />}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default FeedbackWidget;