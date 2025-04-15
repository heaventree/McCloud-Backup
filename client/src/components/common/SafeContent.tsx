/**
 * SafeContent Component
 * 
 * A component for safely rendering user-generated content with XSS protection.
 * This component uses a combination of sanitization and React's dangerouslySetInnerHTML
 * to safely render HTML content.
 */

import React, { useMemo } from 'react';
import DOMPurify from 'dompurify';

// Define allowed HTML tags and attributes for different security levels
const VERY_RESTRICTIVE_CONFIG = {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'br'],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel'],
  ALLOW_DATA_ATTR: false,
};

const MODERATE_CONFIG = {
  ALLOWED_TAGS: [
    'b', 'i', 'em', 'strong', 'a', 'p', 'br', 'ul', 'ol', 'li', 
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code',
    'hr', 'span', 'div'
  ],
  ALLOWED_ATTR: ['href', 'title', 'target', 'rel', 'class', 'id', 'style'],
  ALLOW_DATA_ATTR: false,
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
  FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover']
};

type SecurityLevel = 'high' | 'moderate' | 'raw';

interface SafeContentProps {
  /** The content to be rendered */
  content: string;
  /** The HTML tag to use for the container */
  tag?: keyof JSX.IntrinsicElements;
  /** The CSS class to apply to the container */
  className?: string;
  /** The security level for sanitization */
  securityLevel?: SecurityLevel;
  /** Additional props to pass to the container element */
  containerProps?: React.HTMLAttributes<HTMLElement>;
}

/**
 * Safely renders HTML content with XSS protection
 */
export const SafeContent: React.FC<SafeContentProps> = ({
  content,
  tag = 'div',
  className = '',
  securityLevel = 'high',
  containerProps = {}
}) => {
  const sanitizedContent = useMemo(() => {
    // Skip sanitization if content is empty
    if (!content) return '';
    
    // Configure sanitization based on security level
    if (securityLevel === 'high') {
      return DOMPurify.sanitize(content, VERY_RESTRICTIVE_CONFIG);
    } else if (securityLevel === 'moderate') {
      return DOMPurify.sanitize(content, MODERATE_CONFIG);
    } else if (securityLevel === 'raw') {
      // Warning: Only use 'raw' for content from completely trusted sources
      return DOMPurify.sanitize(content);
    }
    
    // Default to high security
    return DOMPurify.sanitize(content, VERY_RESTRICTIVE_CONFIG);
  }, [content, securityLevel]);
  
  // Create the element with the specified tag
  const CustomTag = tag as any;
  
  return (
    <CustomTag 
      {...containerProps}
      className={className} 
      dangerouslySetInnerHTML={{ __html: sanitizedContent }} 
    />
  );
};

/**
 * Version of SafeContent that only allows text (no HTML)
 */
export const SafeText: React.FC<Omit<SafeContentProps, 'securityLevel'>> = ({
  content,
  tag = 'span',
  className = '',
  containerProps = {}
}) => {
  // Strip all HTML, only keep text
  const textContent = useMemo(() => {
    if (!content) return '';
    
    // Create a temporary DOM element and set its innerHTML to the content
    const tempElement = document.createElement('div');
    tempElement.innerHTML = content;
    
    // Extract text content (which removes all HTML)
    return tempElement.textContent || '';
  }, [content]);
  
  const CustomTag = tag as any;
  
  return (
    <CustomTag {...containerProps} className={className}>
      {textContent}
    </CustomTag>
  );
};

export default SafeContent;