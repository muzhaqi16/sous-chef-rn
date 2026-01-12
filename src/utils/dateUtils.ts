/**
 * Safely extracts YYYY-MM-DD from any date-like value
 * Handles formats like:
 * - "1992-04-18T00:00:00.000+00:00"
 * - "1992-04-18T00:00:00.000Z"
 * - "1992-04-18"
 * - Date objects
 */
export const extractDateString = (value: any): string => {
  if (!value) return '';

  // If it's already a Date object
  if (value instanceof Date && !isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Check if it's a number (Unix timestamp)
  if (typeof value === 'number' || !isNaN(Number(value))) {
    const timestamp = Number(value);
    // Unix timestamps are typically 10 digits (seconds) or 13 digits (milliseconds)
    // Anything reasonable between 1970 and 2100
    if (timestamp > 0 && timestamp < 4102444800000) {
      // If it's in seconds (10 digits or less), convert to milliseconds
      const msTimestamp =
        timestamp < 10000000000 ? timestamp * 1000 : timestamp;
      const date = new Date(msTimestamp);
      if (!isNaN(date.getTime())) {
        // Use UTC methods to avoid timezone issues
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      }
    }
  }

  const str = String(value).trim();

  // Try to extract YYYY-MM-DD pattern from the string
  // This will work with ISO strings, timestamps, etc.
  const dateMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (dateMatch) {
    // Return the full match (YYYY-MM-DD)
    return `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`;
  }

  // If no pattern match, try to parse as a Date
  try {
    const date = new Date(str);
    if (!isNaN(date.getTime())) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  } catch (error) {
    console.warn('Could not parse date:', str, error);
  }

  return '';
};

/**
 * Converts YYYY-MM-DD to a proper ISO string for the database
 * Returns format: "1992-04-18T00:00:00.000Z"
 */
export const dateStringToISO = (dateStr: string): string => {
  if (!dateStr) return dateStr;

  // Validate format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    console.warn('Invalid date format for conversion:', dateStr);
    return dateStr;
  }

  try {
    // Parse the date components
    const [year, month, day] = dateStr.split('-').map(Number);

    // Create a date in UTC
    const date = new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));

    // Validate it's a real date
    if (isNaN(date.getTime())) {
      console.warn('Invalid date values:', dateStr);
      return dateStr;
    }

    // Return ISO string
    return date.toISOString();
  } catch (error) {
    console.error('Error converting date:', error);
    return dateStr;
  }
};

/**
 * Validates YYYY-MM-DD format
 */
export const isValidDateString = (dateStr: string): boolean => {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return false;
  }

  const [year, month, day] = dateStr.split('-').map(Number);

  // Basic validation
  if (year < 1900 || year > 2100) return false;
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > 31) return false;

  // Check if the date is actually valid (handles things like Feb 30)
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
};

/**
 * Safely creates a Date object from any value, returns null if invalid
 * Useful for handling potentially invalid date strings in notifications
 */
export const safeParseDate = (value: any): Date | null => {
  if (!value) return null;

  // If it's already a Date object
  if (value instanceof Date) {
    return !isNaN(value.getTime()) ? value : null;
  }

  // Check if it's a number (Unix timestamp)
  if (typeof value === 'number' || !isNaN(Number(value))) {
    const timestamp = Number(value);
    if (timestamp > 0 && timestamp < 4102444800000) {
      const msTimestamp =
        timestamp < 10000000000 ? timestamp * 1000 : timestamp;
      const date = new Date(msTimestamp);
      return !isNaN(date.getTime()) ? date : null;
    }
  }

  // Try to parse string values
  try {
    const date = new Date(value);
    return !isNaN(date.getTime()) ? date : null;
  } catch {
    return null;
  }
};

/**
 * Safely formats a date value for display, with fallback text
 */
export const safeFormatDate = (value: any, fallback = 'Recently'): string => {
  const date = safeParseDate(value);
  return date ? date.toISOString() : fallback;
};
