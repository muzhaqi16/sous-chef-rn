import { createTestStore } from '#/test-utils/createTestStore';

// Mock authSlice dependencies
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

describe('uiSlice', () => {
  describe('initial state', () => {
    it('starts with default values', () => {
      const store = createTestStore();
      const state = store.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isError).toBe(false);
      expect(state.isFetching).toBe(false);
      expect(state.globalLoading.isLoading).toBe(false);
      expect(state.bottomSheetVisible).toBe(false);
      expect(state.activeFormId).toBeNull();
      expect(state.globalSearchQuery).toBe('');
      expect(state.toastMessage).toBeNull();
      expect(state.toastType).toBeNull();
    });
  });

  describe('loading states', () => {
    it('setLoading updates isLoading', () => {
      const store = createTestStore();
      store.getState().setLoading(true);
      expect(store.getState().isLoading).toBe(true);
    });

    it('setError updates isError', () => {
      const store = createTestStore();
      store.getState().setError(true);
      expect(store.getState().isError).toBe(true);
    });

    it('setFetching updates isFetching', () => {
      const store = createTestStore();
      store.getState().setFetching(true);
      expect(store.getState().isFetching).toBe(true);
    });
  });

  describe('global loading', () => {
    it('setGlobalLoading sets loading state', () => {
      const store = createTestStore();
      store.getState().setGlobalLoading({
        isLoading: true,
        message: 'Saving...',
        context: 'save',
      });
      const gl = store.getState().globalLoading;
      expect(gl.isLoading).toBe(true);
      expect(gl.message).toBe('Saving...');
      expect(gl.context).toBe('save');
    });

    it('clearGlobalLoading resets loading state', () => {
      const store = createTestStore();
      store.getState().setGlobalLoading({ isLoading: true, message: 'X' });
      store.getState().clearGlobalLoading();
      expect(store.getState().globalLoading.isLoading).toBe(false);
      expect(store.getState().globalLoading.message).toBeUndefined();
    });
  });

  describe('bottom sheet', () => {
    it('setBottomSheetVisible toggles visibility', () => {
      const store = createTestStore();
      store.getState().setBottomSheetVisible(true);
      expect(store.getState().bottomSheetVisible).toBe(true);
    });

    it('setBottomSheetIndex updates index', () => {
      const store = createTestStore();
      store.getState().setBottomSheetIndex(2);
      expect(store.getState().bottomSheetIndex).toBe(2);
    });
  });

  describe('form state', () => {
    it('setActiveForm sets form id and data', () => {
      const store = createTestStore();
      store.getState().setActiveForm('form-1', { field: 'value' });
      expect(store.getState().activeFormId).toBe('form-1');
      expect(store.getState().formData['form-1']).toEqual({ field: 'value' });
    });

    it('updateFormData merges data', () => {
      const store = createTestStore();
      store.getState().setActiveForm('form-1', { a: 1 });
      store.getState().updateFormData('form-1', { b: 2 });
      expect(store.getState().formData['form-1']).toEqual({ a: 1, b: 2 });
    });

    it('updateFormData creates data if missing', () => {
      const store = createTestStore();
      store.getState().updateFormData('form-2', { x: 'y' });
      expect(store.getState().formData['form-2']).toEqual({ x: 'y' });
    });

    it('clearFormData removes form data', () => {
      const store = createTestStore();
      store.getState().setActiveForm('form-1', { a: 1 });
      store.getState().clearFormData('form-1');
      expect(store.getState().formData['form-1']).toBeUndefined();
    });
  });

  describe('search and filters', () => {
    it('setGlobalSearchQuery updates query', () => {
      const store = createTestStore();
      store.getState().setGlobalSearchQuery('chicken');
      expect(store.getState().globalSearchQuery).toBe('chicken');
    });

    it('setActiveFilters updates filters', () => {
      const store = createTestStore();
      store.getState().setActiveFilters({ category: 'dairy' });
      expect(store.getState().activeFilters).toEqual({ category: 'dairy' });
    });
  });

  describe('toast', () => {
    it('showToast sets message and type', () => {
      const store = createTestStore();
      store.getState().showToast('Saved!', 'success');
      expect(store.getState().toastMessage).toBe('Saved!');
      expect(store.getState().toastType).toBe('success');
    });

    it('hideToast clears message and type', () => {
      const store = createTestStore();
      store.getState().showToast('Error', 'error');
      store.getState().hideToast();
      expect(store.getState().toastMessage).toBeNull();
      expect(store.getState().toastType).toBeNull();
    });
  });

  describe('resetUI', () => {
    it('resets all UI state to defaults', () => {
      const store = createTestStore();
      store.getState().setLoading(true);
      store.getState().setError(true);
      store.getState().showToast('X', 'error');
      store.getState().setGlobalSearchQuery('test');
      store.getState().resetUI();
      const state = store.getState();
      expect(state.isLoading).toBe(false);
      expect(state.isError).toBe(false);
      expect(state.toastMessage).toBeNull();
      expect(state.globalSearchQuery).toBe('');
    });
  });
});
