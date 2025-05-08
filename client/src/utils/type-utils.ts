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
  if (typeof value === 'string') {
    return value;
  }
  return defaultValue;
}

/**
 * Convert unknown to number safely with a default value
 */
export function safeNumber(value: unknown, defaultValue: number = 0): number {
  if (typeof value === 'number') {
    return value;
  }
  return defaultValue;
}

/**
 * Convert unknown to boolean safely with a default value
 */
export function safeBoolean(value: unknown, defaultValue: boolean = false): boolean {
  if (typeof value === 'boolean') {
    return value;
  }
  return defaultValue;
}