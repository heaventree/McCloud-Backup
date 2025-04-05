import React, { useEffect, useState } from 'react';
import { fetchSvgIcon, getStorageProviderIconSlug } from '@/lib/svglApi';
import { cn } from '@/lib/utils';

interface SvglIconProps {
  /** The slug of the icon to display (e.g., 'google-drive', 'dropbox') */
  slug?: string;
  /** The storage provider type, used to determine the icon slug */
  providerType?: string;
  /** CSS class name for styling */
  className?: string;
  /** Width of the icon (default: 24px) */
  width?: number;
  /** Height of the icon (default: 24px) */
  height?: number;
  /** Fill color (default: currentColor) */
  fill?: string;
}

/**
 * SvglIcon component for displaying SVG icons from SVGL
 */
export function SvglIcon({
  slug,
  providerType,
  className,
  width = 24,
  height = 24,
  fill = 'currentColor',
}: SvglIconProps) {
  const [svgContent, setSvgContent] = useState<string>('');

  useEffect(() => {
    const iconSlug = slug || (providerType ? getStorageProviderIconSlug(providerType) : '');
    
    if (iconSlug) {
      // Fetch the SVG content
      fetchSvgIcon(iconSlug)
        .then((svg) => {
          setSvgContent(svg);
        })
        .catch((err) => {
          console.error('Error loading SVG:', err);
        });
    }
  }, [slug, providerType]);

  if (!svgContent) {
    // Display a loading placeholder or fallback
    return (
      <div 
        className={cn('inline-block', className)} 
        style={{ width: `${width}px`, height: `${height}px` }}
      />
    );
  }

  // Create a safe wrapper for the SVG content
  return (
    <div 
      className={cn('inline-block', className)}
      style={{ width: `${width}px`, height: `${height}px` }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}