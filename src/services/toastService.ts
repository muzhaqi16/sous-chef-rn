/**
 * Toast Service - Unified toast/snackbar notifications
 *
 * This service provides a consistent way to show user feedback messages
 * without blocking the UI like Alert.alert does.
 *
 * Usage:
 * ```typescript
 * import { toastService } from '#/services/toastService';
 *
 * toastService.success('Item added successfully');
 * toastService.error('Failed to delete item');
 * toastService.info('This feature is coming soon');
 * toastService.warning('You have unsaved changes');
 * ```
 */

/**
 * Toast configuration options
 */
export interface ToastOptions {
  duration?: number; // Duration in milliseconds (default: 3000)
  position?: 'top' | 'center' | 'bottom'; // Position on screen (default: 'bottom')
  action?: {
    label: string;
    onPress: () => void;
  };
}

/**
 * Toast callback type for the provider
 */
type ToastCallback = (
  message: string,
  type: 'success' | 'error' | 'info' | 'warning',
  options?: ToastOptions,
) => void;

class ToastService {
  private showToastFn: ToastCallback | null = null;

  /**
   * Initialize the toast service with the toast provider's show function
   * This should be called once by the ToastProvider component
   */
  init(showToast: ToastCallback) {
    this.showToastFn = showToast;
  }

  /**
   * Show a success toast
   */
  success(message: string, options?: ToastOptions) {
    if (!this.showToastFn) {
      console.warn('[ToastService] Not initialized. Message:', message);
      return;
    }
    this.showToastFn(message, 'success', options);
  }

  /**
   * Show an error toast
   */
  error(message: string, options?: ToastOptions) {
    if (!this.showToastFn) {
      console.warn('[ToastService] Not initialized. Message:', message);
      return;
    }
    this.showToastFn(message, 'error', options);
  }

  /**
   * Show an info toast
   */
  info(message: string, options?: ToastOptions) {
    if (!this.showToastFn) {
      console.warn('[ToastService] Not initialized. Message:', message);
      return;
    }
    this.showToastFn(message, 'info', options);
  }

  /**
   * Show a warning toast
   */
  warning(message: string, options?: ToastOptions) {
    if (!this.showToastFn) {
      console.warn('[ToastService] Not initialized. Message:', message);
      return;
    }
    this.showToastFn(message, 'warning', options);
  }

  /**
   * Show error with action button (e.g., "Retry")
   */
  errorWithAction(
    message: string,
    action: { label: string; onPress: () => void },
    options?: Omit<ToastOptions, 'action'>,
  ) {
    this.error(message, { ...options, action });
  }

  /**
   * Show success with action button (e.g., "View")
   */
  successWithAction(
    message: string,
    action: { label: string; onPress: () => void },
    options?: Omit<ToastOptions, 'action'>,
  ) {
    this.success(message, { ...options, action });
  }
}

// Export singleton instance
export const toastService = new ToastService();

// Export hook for use in components
export const useToastService = () => toastService;

/**
 * Helper function to show error from ErrorResult
 */
export const showErrorToast = (error: { message: string; code?: string }) => {
  toastService.error(error.message);
};
