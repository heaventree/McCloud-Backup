/**
 * Type guard for checking if a value is not undefined and not null
 */
export function isDefined<T>(value: T | undefined | null): value is T {
  return value !== undefined && value !== null;
}

/**
 * Type guard for checking if a value is an array
 */
export function isArray<T>(value: unknown): value is T[] {
  return Array.isArray(value);
}

/**
 * Safe array access - returns the array if the value is an array, otherwise an empty array
 */
export function safeArray<T>(value: unknown): T[] {
  return isArray<T>(value) ? value : [];
}

/**
 * Convert unknown to string safely with a default value
 */
export function safeString(value: unknown, defaultValue: string = ""): string {
  if (typeof value === 'string') return value;
  if (value === null || value === undefined) return defaultValue;
  try {
    return String(value);
  } catch {
    return defaultValue;
  }
}

/**
 * Convert unknown to number safely with a default value
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number') return value;
  if (value === null || value === undefined) return defaultValue;
  try {
    const num = Number(value);
    return isNaN(num) ? defaultValue : num;
  } catch {
    return defaultValue;
  }
}

/**
 * Convert unknown to boolean safely with a default value
 */
export function safeBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') return value;
  if (value === null || value === undefined) return defaultValue;
  if (value === 'true') return true;
  if (value === 'false') return false;
  return Boolean(value);
}

/**
 * Get CSS path for an element
 */
export function getCssPath(element: HTMLElement): string {
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
}