/**
 * This file handles preloading of critical chunks
 * to prevent 429 rate limit errors in Replit environment
 */

// Function to preload a JavaScript file
function preloadScript(src: string): void {
  const link = document.createElement('link');
  link.rel = 'preload';
  link.as = 'script';
  link.href = src;
  document.head.appendChild(link);
}

// Preload common chunks that were experiencing 429 errors
export function preloadCommonChunks(): void {
  // Add small delay to let the main app load first
  setTimeout(() => {
    // Critical chunks to preload - these were the ones showing 429 errors
    // Get the base URL to handle both development and production environments
    const base = window.location.origin;
    const criticalChunks = [
      `${base}/src/components/ui/button.tsx`,
      `${base}/src/components/ui/card.tsx`,
      `${base}/src/components/ui/dialog.tsx`,
      `${base}/src/components/ui/dropdown-menu.tsx`,
      `${base}/src/components/ui/input.tsx`
    ];

    // Preload each chunk with a small delay to prevent concurrent requests
    criticalChunks.forEach((chunk, index) => {
      setTimeout(() => {
        preloadScript(chunk);
      }, index * 200); // 200ms delay between each preload
    });
  }, 500); // Initial 500ms delay
}