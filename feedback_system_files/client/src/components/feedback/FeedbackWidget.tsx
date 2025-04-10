import React, { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MessageSquare, X, Target } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface FeedbackWidgetProps {
  projectId: string;
  apiUrl?: string;
  position?: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  onFeedbackSubmitted?: (feedback: any) => void;
}

export const FeedbackWidget: React.FC<FeedbackWidgetProps> = ({
  projectId,
  apiUrl = '/api/feedbacks',
  position = 'bottom-right',
  onFeedbackSubmitted
}) => {
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isTargeting, setIsTargeting] = useState(false);
  const [hoveredElement, setHoveredElement] = useState<HTMLElement | null>(null);
  const [selectedElement, setSelectedElement] = useState<HTMLElement | null>(null);
  const [elementPath, setElementPath] = useState<string | null>(null);
  const [coordinates, setCoordinates] = useState<{x: number, y: number} | null>(null);
  const [feedback, setFeedback] = useState({
    title: '',
    description: '',
    priority: 'medium'
  });
  
  const widgetRef = useRef<HTMLDivElement>(null);
  
  // Position styles
  const positionClasses = {
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4'
  };
  
  // Handle element targeting mode
  useEffect(() => {
    if (!isTargeting) return;
    
    // Prevent widget from being targeted
    const widgetElement = widgetRef.current;
    
    const handleMouseOver = (e: MouseEvent) => {
      if (widgetElement && widgetElement.contains(e.target as Node)) return;
      
      // Highlight the element under cursor
      const element = e.target as HTMLElement;
      if (element !== hoveredElement) {
        // Remove highlight from previous element
        if (hoveredElement) {
          hoveredElement.style.outline = '';
        }
        
        // Add highlight to current element
        element.style.outline = '2px solid #3b82f6';
        element.style.outlineOffset = '2px';
        setHoveredElement(element);
      }
    };
    
    const handleClick = (e: MouseEvent) => {
      if (widgetElement && widgetElement.contains(e.target as Node)) return;
      
      e.preventDefault();
      e.stopPropagation();
      
      const element = e.target as HTMLElement;
      setSelectedElement(element);
      
      // Get element path
      setElementPath(getCssPath(element));
      
      // Get click coordinates
      setCoordinates({
        x: e.pageX,
        y: e.pageY
      });
      
      // Exit targeting mode
      setIsTargeting(false);
      
      // Remove highlights
      document.body.querySelectorAll('*').forEach(el => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
    };
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsTargeting(false);
        // Remove highlights
        document.body.querySelectorAll('*').forEach(el => {
          (el as HTMLElement).style.outline = '';
          (el as HTMLElement).style.outlineOffset = '';
        });
      }
    };
    
    document.addEventListener('mouseover', handleMouseOver);
    document.addEventListener('click', handleClick, true);
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('mouseover', handleMouseOver);
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('keydown', handleKeyDown);
      
      // Remove any lingering highlights
      document.body.querySelectorAll('*').forEach(el => {
        (el as HTMLElement).style.outline = '';
        (el as HTMLElement).style.outlineOffset = '';
      });
    };
  }, [isTargeting, hoveredElement]);
  
  // Get CSS path for an element
  const getCssPath = (element: HTMLElement): string => {
    if (!element) return '';
    if (element === document.body) return 'body';
    
    const path = [];
    let currentElement: HTMLElement | null = element;
    
    while (currentElement && currentElement !== document.body) {
      let selector = currentElement.tagName.toLowerCase();
      
      // Add id if available
      if (currentElement.id) {
        selector += `#${currentElement.id}`;
        path.unshift(selector);
        break;
      }
      
      // Add classes if available
      if (currentElement.className) {
        const classes = currentElement.className.split(/\s+/).filter(c => c);
        if (classes.length) {
          selector += `.${classes.join('.')}`;
        }
      }
      
      // Add position among siblings if needed
      const siblings = Array.from(currentElement.parentElement?.children || []);
      if (siblings.length > 1) {
        const index = siblings.indexOf(currentElement) + 1;
        selector += `:nth-child(${index})`;
      }
      
      path.unshift(selector);
      currentElement = currentElement.parentElement;
    }
    
    return path.join(' > ');
  };
  
  // Handle input changes
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFeedback(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle select changes
  const handleSelectChange = (name: string, value: string) => {
    setFeedback(prev => ({ ...prev, [name]: value }));
  };
  
  // Handle submit
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.title || !feedback.description) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          projectId,
          pagePath: window.location.pathname,
          elementPath,
          coordinates,
          status: 'open',
          priority: feedback.priority,
          title: feedback.title,
          description: feedback.description
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to submit feedback');
      }
      
      const result = await response.json();
      
      toast({
        title: "Success",
        description: "Your feedback has been submitted"
      });
      
      // Reset form
      setFeedback({
        title: '',
        description: '',
        priority: 'medium'
      });
      setSelectedElement(null);
      setElementPath(null);
      setCoordinates(null);
      setIsOpen(false);
      
      // Call onFeedbackSubmitted callback if provided
      if (onFeedbackSubmitted) {
        onFeedbackSubmitted(result);
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to submit feedback. Please try again.",
        variant: "destructive"
      });
    }
  };
  
  // Start targeting mode
  const startTargeting = () => {
    setIsTargeting(true);
    setIsOpen(false);
  };
  
  // Cancel targeting
  const cancelTargeting = () => {
    setIsTargeting(false);
    setSelectedElement(null);
    setElementPath(null);
    setCoordinates(null);
  };
  
  return (
    <div ref={widgetRef} className={`fixed z-50 ${positionClasses[position]}`}>
      {isTargeting && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-40 flex items-center justify-center">
          <div className="bg-white rounded-lg p-4 max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Select an element</h2>
              <Button variant="ghost" size="icon" onClick={cancelTargeting}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Click on any element on the page to provide feedback for it.
              Press ESC to cancel.
            </p>
          </div>
        </div>
      )}
      
      {isOpen && (
        <Card className="p-4 w-80 shadow-lg">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-medium">Submit Feedback</h3>
            <Button variant="ghost" size="icon" onClick={() => setIsOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input
                name="title"
                value={feedback.title}
                onChange={handleInputChange}
                placeholder="Brief description of the issue"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <Textarea
                name="description"
                value={feedback.description}
                onChange={handleInputChange}
                placeholder="Detailed explanation of the feedback"
                required
                rows={4}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">Priority</label>
              <Select
                value={feedback.priority}
                onValueChange={(value) => handleSelectChange('priority', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="pt-2">
              <Button
                type="button"
                variant="outline"
                className="w-full mb-2"
                onClick={startTargeting}
              >
                <Target className="h-4 w-4 mr-2" />
                Select Element
              </Button>
              
              {selectedElement && (
                <div className="text-xs bg-gray-100 p-2 rounded mb-2 overflow-hidden">
                  <div className="font-medium mb-1">Selected Element:</div>
                  <div className="truncate">{elementPath}</div>
                </div>
              )}
              
              <Button type="submit" className="w-full">
                Submit Feedback
              </Button>
            </div>
          </form>
        </Card>
      )}
      
      {!isOpen && !isTargeting && (
        <Button
          onClick={() => setIsOpen(true)}
          className="rounded-full h-12 w-12 shadow-lg"
        >
          <MessageSquare className="h-5 w-5" />
        </Button>
      )}
    </div>
  );
};

export default FeedbackWidget;