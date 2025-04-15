/**
 * Safe Content Components
 * 
 * This module provides components that safely render user-provided content
 * with proper sanitization to prevent XSS attacks.
 */
import React from 'react';
import { sanitizeString, stripHtml, sanitizeUrl, createTrustedHtml, formatMarkdown } from '@/utils/xssProtection';

interface SafeTextProps {
  content: string | undefined | null;
  className?: string;
  stripTags?: boolean;
}

/**
 * Safely renders text content with proper sanitization
 */
export const SafeText: React.FC<SafeTextProps> = ({ 
  content, 
  className = '', 
  stripTags = false 
}) => {
  const safeContent = stripTags ? stripHtml(content) : sanitizeString(content);
  
  return (
    <span className={className}>{safeContent}</span>
  );
};

interface SafeHtmlProps {
  content: string | undefined | null;
  className?: string;
  allowedTags?: string[];
}

/**
 * Safely renders HTML content with proper sanitization
 * Note: This should only be used for trusted content that needs HTML rendering
 */
export const SafeHtml: React.FC<SafeHtmlProps> = ({ 
  content, 
  className = ''
}) => {
  // For this simple implementation, we're just sanitizing the content
  // In a production environment, we would use a proper HTML sanitizer like DOMPurify
  // with a specific allowlist of tags
  const safeContent = sanitizeString(content);
  
  return (
    <div 
      className={className} 
      dangerouslySetInnerHTML={createTrustedHtml(safeContent)} 
    />
  );
};

interface SafeMarkdownProps {
  content: string | undefined | null;
  className?: string;
}

/**
 * Safely renders simplified markdown content
 */
export const SafeMarkdown: React.FC<SafeMarkdownProps> = ({ 
  content, 
  className = '' 
}) => {
  const formattedContent = formatMarkdown(content);
  
  return (
    <div 
      className={className} 
      dangerouslySetInnerHTML={createTrustedHtml(formattedContent)} 
    />
  );
};

interface SafeLinkProps {
  href: string;
  className?: string;
  children: React.ReactNode;
  target?: '_blank' | '_self' | '_parent' | '_top';
  rel?: string;
}

/**
 * Safely renders a link with proper URL sanitization
 */
export const SafeLink: React.FC<SafeLinkProps> = ({ 
  href, 
  className = '', 
  children, 
  target = '_blank',
  rel = 'noopener noreferrer'
}) => {
  const safeHref = sanitizeUrl(href);
  
  if (!safeHref) {
    return <span className={className}>{children}</span>;
  }
  
  return (
    <a 
      href={safeHref} 
      className={className} 
      target={target} 
      rel={rel}
    >
      {children}
    </a>
  );
};

interface SafeImageProps {
  src: string;
  alt: string;
  className?: string;
  width?: number | string;
  height?: number | string;
}

/**
 * Safely renders an image with proper URL sanitization
 */
export const SafeImage: React.FC<SafeImageProps> = ({ 
  src, 
  alt, 
  className = '', 
  width, 
  height 
}) => {
  const safeSrc = sanitizeUrl(src);
  const safeAlt = stripHtml(alt);
  
  if (!safeSrc) {
    return <div className={`${className} bg-gray-200`} style={{ width, height }} />;
  }
  
  return (
    <img 
      src={safeSrc} 
      alt={safeAlt} 
      className={className} 
      width={width} 
      height={height} 
      loading="lazy" 
      onError={(e) => {
        // Replace broken images with a placeholder
        e.currentTarget.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"%3E%3Crect x="3" y="3" width="18" height="18" rx="2" ry="2"%3E%3C/rect%3E%3Ccircle cx="8.5" cy="8.5" r="1.5"%3E%3C/circle%3E%3Cpolyline points="21 15 16 10 5 21"%3E%3C/polyline%3E%3C/svg%3E';
        e.currentTarget.alt = 'Image not available';
      }}
    />
  );
};

export default {
  SafeText,
  SafeHtml,
  SafeMarkdown,
  SafeLink,
  SafeImage
};