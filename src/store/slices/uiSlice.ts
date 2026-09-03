// ============================================
// Pure UI state management - no server data
// ============================================

import { StateCreator } from 'zustand';
import type { RootState } from '../index';

export interface UIState {
  // Modal and overlay states
  isLoading: boolean;
  isError: boolean;
  isFetching: boolean;

  // Global loading overlay state
  globalLoading: {
    isLoading: boolean;
    message?: string;
    context?: string;
    cancelable?: boolean;
  };

  // Bottom sheet states
  bottomSheetVisible: boolean;
  bottomSheetIndex: number;

  // Form states
  activeFormId: string | null;
  formData: Record<string, Record<string, unknown>>;

  // Search and filter states
  globalSearchQuery: string;
  activeFilters: Record<string, unknown>;

  // Toast and notification states
  toastMessage: string | null;
  toastType: 'success' | 'error' | 'info' | 'warning' | null;

  // Cross-navigation scroll flags
  pendingPantryScrollToTop: boolean;

  // Tutorial reset signal (session-only counter; bumped by resetAllFeatureHints)
  tutorialResetGeneration: number;

  // Actions
  setLoading: (loading: boolean) => void;
  setError: (error: boolean) => void;
  setFetching: (fetching: boolean) => void;

  // Global loading actions
  setGlobalLoading: (state: {
    isLoading: boolean;
    message?: string;
    context?: string;
    cancelable?: boolean;
  }) => void;
  clearGlobalLoading: () => void;

  setBottomSheetVisible: (visible: boolean) => void;
  setBottomSheetIndex: (index: number) => void;

  setActiveForm: (
    formId: string | null,
    data?: Record<string, unknown>,
  ) => void;
  updateFormData: (formId: string, data: Record<string, unknown>) => void;
  clearFormData: (formId: string) => void;
  setGlobalSearchQuery: (query: string) => void;
  setActiveFilters: (filters: Record<string, unknown>) => void;
  setPendingPantryScrollToTop: (pending: boolean) => void;
  bumpTutorialResetGeneration: () => void;
  showToast: (
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
  ) => void;
  hideToast: () => void;
  resetUI: () => void;
}

const initialUIState = {
  isLoading: false,
  isError: false,
  isFetching: false,
  globalLoading: {
    isLoading: false,
    message: undefined,
    context: undefined,
    cancelable: false,
  },
  bottomSheetVisible: false,
  bottomSheetIndex: 0,
  activeFormId: null,
  formData: {},
  globalSearchQuery: '',
  activeFilters: {},
  toastMessage: null,
  toastType: null,
  pendingPantryScrollToTop: false,
  tutorialResetGeneration: 0,
};

export const createUISlice: StateCreator<
  RootState,
  [['zustand/immer', never]],
  [],
  UIState
> = set => ({
  ...initialUIState,

  setLoading: loading => {
    set(state => {
      state.isLoading = loading;
    });
  },

  setError: error => {
    set(state => {
      state.isError = error;
    });
  },

  setFetching: fetching => {
    set(state => {
      state.isFetching = fetching;
    });
  },

  setGlobalLoading: loadingState => {
    set(state => {
      state.globalLoading = loadingState;
    });
  },

  clearGlobalLoading: () => {
    set(state => {
      state.globalLoading = {
        isLoading: false,
        message: undefined,
        context: undefined,
        cancelable: false,
      };
    });
  },

  setBottomSheetVisible: visible => {
    set(state => {
      state.bottomSheetVisible = visible;
    });
  },

  setBottomSheetIndex: index => {
    set(state => {
      state.bottomSheetIndex = index;
    });
  },

  setActiveForm: (formId, data = {}) => {
    set(state => {
      state.activeFormId = formId;
      if (formId && data) {
        state.formData[formId] = data;
      }
    });
  },

  updateFormData: (formId, data) => {
    set(state => {
      if (!state.formData[formId]) {
        state.formData[formId] = {};
      }
      Object.assign(state.formData[formId], data);
    });
  },

  clearFormData: formId => {
    set(state => {
      delete state.formData[formId];
    });
  },

  setGlobalSearchQuery: query => {
    set(state => {
      state.globalSearchQuery = query;
    });
  },

  setActiveFilters: filters => {
    set(state => {
      state.activeFilters = filters;
    });
  },

  setPendingPantryScrollToTop: pending => {
    set(state => {
      state.pendingPantryScrollToTop = pending;
    });
  },

  bumpTutorialResetGeneration: () => {
    set(state => {
      state.tutorialResetGeneration += 1;
    });
  },

  showToast: (message, type) => {
    set(state => {
      state.toastMessage = message;
      state.toastType = type;
    });
  },

  hideToast: () => {
    set(state => {
      state.toastMessage = null;
      state.toastType = null;
    });
  },

  resetUI: () => {
    set(state => {
      Object.assign(state, initialUIState);
    });
  },
});
