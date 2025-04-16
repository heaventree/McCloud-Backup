import React, { useState, useEffect, useRef } from 'react';
import { MessageSquare, Check, Send, Target, X } from 'lucide-react';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Feedback } from '@shared/schema';
import { SafeText } from '@/components/common/SafeContent';
import xssProtection from '@/utils/xssProtection';
const { sanitizeString } = xssProtection;
import ErrorBoundary from '@/components/error/ErrorBoundary';
import { createPortal } from 'react-dom';

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

const FeedbackWidgetComponent: React.FC<FeedbackWidgetProps> = ({
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
          // Sanitize the element path to prevent XSS
          elementPath = sanitizeString(selectedElement.path);
          console.log("Submitting feedback with element path:", elementPath);
        }
      }
      
      const feedback = {
        // Sanitize all user-provided input to prevent XSS attacks
        projectId: sanitizeString(projectId),
        pagePath: sanitizeString(window.location.pathname),
        x: x,
        y: y,
        elementPath: elementPath,
        comment: sanitizeString(comment.trim()),
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
      
    } catch (error: unknown) {
      console.error('Error submitting feedback:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      alert(`Failed to submit feedback: ${errorMessage}`);
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
              <span className="text-sm font-medium">
                <SafeText content="Click on any element to leave feedback" />
              </span>
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
      
      {/* Feedback Button */}
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
                <SafeText content={selectedElement ? 'Feedback on this element' : 'General Feedback'} />
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
                <p className="text-gray-900 dark:text-gray-100">
                  <SafeText content="Thank you for your feedback!" />
                </p>
              </div>
            ) : (
              <>
                <textarea
                  className="w-full p-3 text-sm border border-gray-200 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 mb-4 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
                  placeholder={selectedElement ? "What about this element?" : "What do you think of this page or feature?"}
                  rows={4}
                  value={comment}
                  onChange={(e) => {
                    // Store original input, we'll sanitize before sending to API
                    setComment(e.target.value);
                  }}
                  autoFocus
                  aria-label="Feedback comment"
                />
                <div className="flex justify-between items-center">
                  <div className="text-xs text-gray-500">
                    <SafeText content="Feedback will be visible in the dashboard" />
                  </div>
                  <button
                    onClick={submitFeedback}
                    disabled={!comment.trim() || submitting}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
                  >
                    <SafeText content={submitting ? 'Sending...' : 'Send'} />
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

// CSS for the Shadow DOM
const shadowDomStyles = `
  :host {
    all: initial;
    display: block;
    font-family: system-ui, -apple-system, sans-serif;
    font-size: 16px;
    line-height: 1.5;
    color: #000;
    --primary-color: #2563eb;
    --primary-hover: #1d4ed8;
    --bg-color: #ffffff;
    --border-color: #e5e7eb;
    --text-color: #111827;
    --text-muted: #6b7280;
    --success-color: #10b981;
    --success-bg: #d1fae5;
    --ring-color: rgba(59, 130, 246, 0.5);
  }
  
  /* Base Widget Styles */
  .feedback-widget-container {
    font-family: system-ui, -apple-system, sans-serif;
    position: fixed;
    bottom: 20px;
    right: 20px;
    z-index: 10000;
  }
  
  /* Button Styles */
  .feedback-button {
    width: 48px;
    height: 48px;
    background-color: var(--primary-color);
    color: white;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
    border: none;
    outline: none;
    transition: background-color 0.2s;
  }
  
  .feedback-button:hover {
    background-color: var(--primary-hover);
  }
  
  /* Form Styles */
  .feedback-form {
    position: fixed;
    z-index: 10001;
    width: 320px;
    background-color: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05);
    overflow: hidden;
  }
  
  .feedback-form-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 16px 20px 12px;
    border-bottom: 1px solid var(--border-color);
  }
  
  .feedback-form-title {
    font-size: 18px;
    font-weight: 500;
    color: var(--text-color);
    margin: 0;
  }
  
  .feedback-close-button {
    background: transparent;
    border: none;
    cursor: pointer;
    color: var(--text-muted);
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .feedback-form-content {
    padding: 16px 20px;
  }
  
  .feedback-textarea {
    width: 100%;
    padding: 12px;
    border: 1px solid var(--border-color);
    border-radius: 6px;
    margin-bottom: 16px;
    font-family: inherit;
    resize: vertical;
    min-height: 100px;
    outline: none;
  }
  
  .feedback-textarea:focus {
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px var(--ring-color);
  }
  
  .feedback-form-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .feedback-submit-button {
    padding: 8px 16px;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 6px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 500;
    transition: background-color 0.2s;
  }
  
  .feedback-submit-button:hover:not(:disabled) {
    background-color: var(--primary-hover);
  }
  
  .feedback-submit-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .feedback-help-text {
    font-size: 12px;
    color: var(--text-muted);
  }
  
  /* Success State */
  .feedback-success {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 24px 0;
  }
  
  .feedback-success-icon {
    width: 48px;
    height: 48px;
    background-color: var(--success-bg);
    color: var(--success-color);
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 12px;
  }
  
  /* Element Selection Overlay */
  .feedback-overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.05);
    pointer-events: none;
    z-index: 9990;
  }
  
  .feedback-click-catcher {
    position: fixed;
    inset: 0;
    cursor: crosshair;
    z-index: 9992;
  }
  
  .feedback-highlight {
    position: absolute;
    pointer-events: none;
    border: 2px solid var(--primary-color);
    z-index: 9989;
    transition: all 100ms;
  }
  
  .feedback-overlay-header {
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--primary-color);
    color: white;
    padding: 8px 16px;
    border-radius: 9999px;
    z-index: 9991;
    display: flex;
    align-items: center;
    gap: 8px;
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    pointer-events: auto;
  }
  
  .feedback-overlay-close {
    background-color: rgba(0, 0, 0, 0.2);
    border: none;
    width: 20px;
    height: 20px;
    border-radius: 9999px;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    margin-left: 8px;
    padding: 0;
  }
`;

// Shadow DOM component
const ShadowDOMContainer: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const shadowRootRef = useRef<ShadowRoot | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (hostRef.current && !shadowRootRef.current) {
      // Create shadow root
      shadowRootRef.current = hostRef.current.attachShadow({ mode: 'closed' });
      
      // Add styles to shadow DOM
      const style = document.createElement('style');
      style.textContent = shadowDomStyles;
      shadowRootRef.current.appendChild(style);
      
      // Create container for React content
      const container = document.createElement('div');
      container.className = 'mccloud-feedback-root';
      shadowRootRef.current.appendChild(container);
      
      setMounted(true);
    }
  }, []);

  if (!mounted || !shadowRootRef.current) {
    return <div ref={hostRef}></div>;
  }

  // Find the container inside shadow root
  const container = shadowRootRef.current.querySelector('.mccloud-feedback-root');
  
  if (!container) return <div ref={hostRef}></div>;
  
  // Portal the React content into the shadow DOM
  return (
    <div ref={hostRef}>
      {createPortal(children, container as Element)}
    </div>
  );
};

// Create a secure wrapper component with ErrorBoundary and Shadow DOM
const SecureFeedbackWidget: React.FC<FeedbackWidgetProps> = (props) => {
  // Log error to console and potentially to an error monitoring service
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    console.error('FeedbackWidget Error:', error);
    console.error('Component Stack:', errorInfo.componentStack);
  };

  return (
    <ErrorBoundary onError={handleError}>
      <ShadowDOMContainer>
        <FeedbackWidgetComponent {...props} />
      </ShadowDOMContainer>
    </ErrorBoundary>
  );
};

export default SecureFeedbackWidget;