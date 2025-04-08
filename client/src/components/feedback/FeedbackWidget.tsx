import React, { useState, useEffect } from 'react';
import { MessageSquare, Check, Send, Target, X } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Feedback } from '@shared/schema';

interface FeedbackWidgetProps {
  projectId?: string;
}

interface TargetElementInfo {
  element: HTMLElement;
  rect: DOMRect;
  path: string;
  x: number;
  y: number;
}

const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  projectId = 'default'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<TargetElementInfo | null>(null);
  const [selectedElement, setSelectedElement] = useState<TargetElementInfo | null>(null);
  
  // Helper function to get element path
  const getElementPath = (element: HTMLElement): string => {
    let path = '';
    let currentElement: HTMLElement | null = element;
    
    // Get the element id or class for identification
    const getElementIdentifier = (el: HTMLElement): string => {
      if (el.id) return `#${el.id}`;
      if (el.className && typeof el.className === 'string' && el.className.trim()) {
        return `.${el.className.trim().split(/\s+/).join('.')}`;
      }
      return el.tagName.toLowerCase();
    };
    
    // Get parent elements until body
    while (currentElement && currentElement !== document.body) {
      path = `${getElementIdentifier(currentElement)}${path ? ' > ' + path : ''}`;
      currentElement = currentElement.parentElement;
    }
    
    return path || 'Unknown';
  };
  
  // Toggle selection mode
  const toggleSelectionMode = () => {
    setSelectMode(!selectMode);
    if (selectMode) {
      setHoveredElement(null);
      setSelectedElement(null);
    }
  };
  
  // Toggle feedback form
  const toggleFeedback = () => {
    if (selectMode) {
      toggleSelectionMode();
    }
    setIsOpen(!isOpen);
    setSuccess(false);
  };
  
  // Handle mouse move for element highlighting
  useEffect(() => {
    if (!selectMode) return;
    
    // Create a transparent, non-interactive overlay for detecting hover elements
    const overlayElement = document.createElement('div');
    overlayElement.style.position = 'fixed';
    overlayElement.style.top = '0';
    overlayElement.style.left = '0';
    overlayElement.style.width = '100%';
    overlayElement.style.height = '100%';
    overlayElement.style.pointerEvents = 'none'; // Make sure it doesn't interfere with mouse events
    overlayElement.style.zIndex = '9990';
    document.body.appendChild(overlayElement);
    
    const handleMouseMove = (e: MouseEvent) => {
      // Get the actual element under the cursor by temporarily hiding any overlays
      const clickCatcher = document.querySelector('.click-catcher') as HTMLElement;
      if (clickCatcher) {
        clickCatcher.style.display = 'none';
      }
      
      const x = e.clientX;
      const y = e.clientY;
      const element = document.elementFromPoint(x, y) as HTMLElement;
      
      // Restore visibility
      if (clickCatcher) {
        clickCatcher.style.display = '';
      }
      
      if (!element) {
        setHoveredElement(null);
        return;
      }
      
      // Ignore feedback widget elements
      if (element.closest('.feedback-widget, .feedback-form, .feedback-overlay, .feedback-header')) {
        setHoveredElement(null);
        return;
      }
      
      const rect = element.getBoundingClientRect();
      
      setHoveredElement({
        element,
        rect,
        path: getElementPath(element),
        x: e.clientX,
        y: e.clientY
      });
    };
    
    // We don't need this handleClick anymore since we're using the overlay's onClick
    
    document.addEventListener('mousemove', handleMouseMove);
    
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.body.removeChild(overlayElement);
    };
  }, [selectMode]);
  
  // Submit feedback
  const submitFeedback = async () => {
    if (!comment.trim()) return;
    
    setSubmitting(true);
    
    try {
      // Calculate relative coordinates if we have a selected element
      let x = 50;
      let y = 50;
      let elementPath = null;
      
      if (selectedElement) {
        x = (selectedElement.x / window.innerWidth) * 100;
        y = (selectedElement.y / window.innerHeight) * 100;
        
        if (selectedElement.path) {
          elementPath = selectedElement.path;
          console.log("Submitting feedback with element path:", elementPath);
        }
      }
      
      const feedback = {
        projectId,
        pagePath: window.location.pathname,
        x: x,
        y: y,
        elementPath: elementPath,
        comment: comment.trim(),
        status: 'open',
        priority: 'medium'
      };
      
      console.log("Submitting feedback:", feedback);
      
      await apiRequest<Feedback>('POST', '/api/feedback', feedback);
      
      // Invalidate queries to refresh the feedback list on all pages
      queryClient.invalidateQueries({ queryKey: ['/api/feedback'] });
      queryClient.invalidateQueries({ queryKey: ['/api/feedback/stats'] });
      
      setSuccess(true);
      setComment('');
      setSelectedElement(null);
      
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
      {/* Selection Mode Overlay */}
      {selectMode && (
        <>
          {/* Click catcher overlay - this is transparent and captures all clicks */}
          <div 
            className="fixed inset-0 z-[9992] cursor-crosshair click-catcher"
            onClick={(e) => {
              // This overlay captures clicks and handles them
              e.preventDefault();
              e.stopPropagation();
              
              // We need to temporarily hide this overlay to find elements beneath it
              const overlay = e.currentTarget as HTMLElement;
              overlay.style.display = 'none';
              
              // Now find the actual element under where we clicked
              const x = e.clientX;
              const y = e.clientY;
              const element = document.elementFromPoint(x, y) as HTMLElement;
              
              // Show the overlay again
              overlay.style.display = '';
              
              if (!element) return;
              
              // Ignore clicks on our widget elements
              if (element.closest('.feedback-widget, .feedback-form, .feedback-overlay, .feedback-header')) {
                return;
              }
              
              const rect = element.getBoundingClientRect();
              console.log('Element selected through overlay:', element);
              console.log('Element path:', getElementPath(element));
              
              setSelectedElement({
                element,
                rect,
                path: getElementPath(element),
                x: e.clientX,
                y: e.clientY
              });
              
              // Exit select mode and open feedback form
              setSelectMode(false);
              setIsOpen(true);
            }}
          ></div>
          
          {/* Visual overlay with instructions */}
          <div className="fixed inset-0 z-[9990] bg-black bg-opacity-5 pointer-events-none feedback-overlay">
            <div className="fixed top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white px-4 py-2 rounded-full z-[9991] flex items-center gap-2 shadow-lg feedback-header pointer-events-auto">
              <Target className="h-4 w-4" />
              <span className="text-sm font-medium">Click on any element to leave feedback</span>
              <button 
                onClick={toggleSelectionMode}
                className="ml-2 bg-blue-700 hover:bg-blue-800 rounded-full w-5 h-5 flex items-center justify-center"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          </div>
        </>
      )}
      
      {/* Element Highlighter */}
      {selectMode && hoveredElement && (
        <div 
          className="absolute pointer-events-none border-2 border-blue-500 z-[9989] feedback-highlight transition-all duration-100"
          style={{
            top: `${hoveredElement.rect.top}px`,
            left: `${hoveredElement.rect.left}px`,
            width: `${hoveredElement.rect.width}px`,
            height: `${hoveredElement.rect.height}px`
          }}
        ></div>
      )}
      
      {/* Feedback Buttons Group */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 items-end feedback-widget">
        {/* Element Selection Button */}
        <button
          className={`w-12 h-12 ${selectMode ? 'bg-blue-700' : 'bg-blue-600 hover:bg-blue-700'} text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200`}
          onClick={toggleSelectionMode}
          aria-label="Select an element"
          title="Click on any element to leave feedback"
        >
          <Target className="h-5 w-5" />
        </button>
        
        {/* General Feedback Button */}
        <button
          className="w-12 h-12 bg-blue-600 hover:bg-blue-700 text-white rounded-full flex items-center justify-center shadow-lg transition-colors duration-200"
          onClick={toggleFeedback}
          aria-label="Leave general feedback"
          title="Leave general feedback"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      </div>

      {/* Feedback Form */}
      {isOpen && (
        <div className="fixed z-[9999] w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl overflow-hidden feedback-form"
          style={{
            bottom: selectedElement ? 'auto' : '20rem',
            right: selectedElement ? 'auto' : '1.25rem',
            top: selectedElement ? `${Math.min(Math.max(10, selectedElement.rect.top), window.innerHeight - 350)}px` : 'auto',
            left: selectedElement ? `${Math.min(Math.max(10, selectedElement.rect.left), window.innerWidth - 340)}px` : 'auto',
          }}
        >
          <div className="px-5 py-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100">
                {selectedElement ? 'Feedback on this element' : 'General Feedback'}
              </h3>
              <button 
                onClick={toggleFeedback}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            
            {/* Element path information hidden from user */}
            
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
                  placeholder={selectedElement ? "What about this element?" : "What do you think of this page or feature?"}
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