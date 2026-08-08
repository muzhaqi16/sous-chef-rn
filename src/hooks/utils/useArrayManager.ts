import { useState } from 'react';
import { t } from '#/i18n/t';
import { alertService } from '#/services/alertService';

/**
 * Module-level try-catch wrapper for array manager operations.
 * Keeps try-catch out of the hook body for React Compiler compatibility.
 */
async function executeArrayOperation<T>(
  operationFn: () => Promise<T>,
  onError: (message: string) => void,
): Promise<T | false> {
  try {
    return await operationFn();
  } catch (err: unknown) {
    onError((err instanceof Error && err.message) || 'An error occurred');
    return false;
  }
}

export interface ArrayManagerOptions<T> {
  /**
   * Initial array values
   */
  initialValues: T[];

  /**
   * Function to update the array (e.g., API call)
   * Should return true on success, false on failure
   */
  onUpdate: (newArray: T[]) => Promise<boolean>;

  /**
   * Custom validation function for new items
   * Return error message string if invalid, null if valid
   */
  validate?: (item: T) => string | null;

  /**
   * Custom equality check for duplicate detection
   * Default uses strict equality (===)
   */
  equals?: (a: T, b: T) => boolean;

  /**
   * Custom item transformer before adding (e.g., trim strings)
   */
  transform?: (item: T) => T;

  /**
   * Show alerts on error (default: true)
   */
  showAlerts?: boolean;
}

export interface ArrayManagerResult<T> {
  /**
   * Current array items
   */
  items: T[];

  /**
   * Add a new item to the array
   */
  add: (item: T) => Promise<boolean>;

  /**
   * Remove an item from the array
   */
  remove: (item: T) => Promise<boolean>;

  /**
   * Update an item in the array
   */
  update: (oldItem: T, newItem: T) => Promise<boolean>;

  /**
   * Clear all items from the array
   */
  clear: () => Promise<boolean>;

  /**
   * Check if an item exists in the array
   */
  has: (item: T) => boolean;

  /**
   * Get the index of an item
   */
  indexOf: (item: T) => number;

  /**
   * Loading state for async operations
   */
  loading: boolean;

  /**
   * Last error message
   */
  error: string | null;

  /**
   * Clear the error message
   */
  clearError: () => void;
}

/**
 * useArrayManager - Generic hook for managing arrays with add/remove/update operations
 *
 * Provides a consistent pattern for managing any type of array with validation,
 * duplicate checking, and API integration.
 *
 * @example Managing string arrays (tags, cuisines, categories)
 * ```tsx
 * const cuisineManager = useArrayManager({
 *   initialValues: profile.preferredCuisines,
 *   onUpdate: async (newCuisines) => {
 *     const success = await updateProfile({ preferredCuisines: newCuisines });
 *     return success;
 *   },
 *   validate: (cuisine) => {
 *     if (!cuisine.trim()) return 'Cuisine cannot be empty';
 *     if (cuisine.length > 50) return 'Cuisine name too long';
 *     return null;
 *   },
 *   transform: (cuisine) => cuisine.trim(),
 * });
 *
 * // Usage
 * await cuisineManager.add('Italian');
 * await cuisineManager.remove('Mexican');
 * ```
 *
 * @example Managing object arrays
 * ```tsx
 * const tagManager = useArrayManager({
 *   initialValues: item.tags,
 *   onUpdate: async (newTags) => updateItemTags(itemId, newTags),
 *   equals: (a, b) => a.id === b.id,
 * });
 * ```
 */
function defaultEquals<T>(a: T, b: T): boolean {
  return a === b;
}

function defaultTransform<T>(item: T): T {
  return item;
}

export function useArrayManager<T>({
  initialValues,
  onUpdate,
  validate,
  equals = defaultEquals,
  transform = defaultTransform,
  showAlerts = true,
}: ArrayManagerOptions<T>): ArrayManagerResult<T> {
  const [items, setItems] = useState<T[]>(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  const showError = (message: string) => {
    setError(message);
    if (showAlerts) {
      alertService.alert(t('labels.error'), message);
    }
  };

  const add = async (item: T): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const result = await executeArrayOperation(async () => {
      // Transform item (e.g., trim strings)
      const transformedItem = transform(item);

      // Validate
      if (validate) {
        const validationError = validate(transformedItem);
        if (validationError) {
          showError(validationError);
          return false;
        }
      }

      // Check for duplicates
      if (items.some(existing => equals(existing, transformedItem))) {
        showError('This item already exists');
        return false;
      }

      // Update via API
      const newItems = [...items, transformedItem];
      const success = await onUpdate(newItems);

      if (success) {
        setItems(newItems);
        return true;
      } else {
        showError('Failed to add item');
        return false;
      }
    }, showError);

    setLoading(false);
    return result === false ? false : result;
  };

  const remove = async (item: T): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const result = await executeArrayOperation(async () => {
      const newItems = items.filter(existing => !equals(existing, item));

      const success = await onUpdate(newItems);

      if (success) {
        setItems(newItems);
        return true;
      } else {
        showError('Failed to remove item');
        return false;
      }
    }, showError);

    setLoading(false);
    return result === false ? false : result;
  };

  const update = async (oldItem: T, newItem: T): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const result = await executeArrayOperation(async () => {
      // Transform new item
      const transformedItem = transform(newItem);

      // Validate
      if (validate) {
        const validationError = validate(transformedItem);
        if (validationError) {
          showError(validationError);
          return false;
        }
      }

      // Check if new item is duplicate (excluding the old item)
      const otherItems = items.filter(existing => !equals(existing, oldItem));
      if (otherItems.some(existing => equals(existing, transformedItem))) {
        showError('This item already exists');
        return false;
      }

      const newItems = items.map(existing =>
        equals(existing, oldItem) ? transformedItem : existing,
      );

      const success = await onUpdate(newItems);

      if (success) {
        setItems(newItems);
        return true;
      } else {
        showError('Failed to update item');
        return false;
      }
    }, showError);

    setLoading(false);
    return result === false ? false : result;
  };

  const clear = async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    const result = await executeArrayOperation(async () => {
      const success = await onUpdate([]);

      if (success) {
        setItems([]);
        return true;
      } else {
        showError('Failed to clear items');
        return false;
      }
    }, showError);

    setLoading(false);
    return result === false ? false : result;
  };

  const has = (item: T): boolean => {
    return items.some(existing => equals(existing, item));
  };

  const indexOf = (item: T): number => {
    return items.findIndex(existing => equals(existing, item));
  };

  return {
    items,
    add,
    remove,
    update,
    clear,
    has,
    indexOf,
    loading,
    error,
    clearError,
  };
}
