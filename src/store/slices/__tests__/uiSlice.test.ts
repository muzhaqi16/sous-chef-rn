import { createTestStore } from '#/test-utils/createTestStore';
import type { ImageFile } from '#/types/media';

// Mock authSlice dependencies
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

const image: ImageFile = {
  uri: 'file:///cropped.jpg',
  type: 'image/jpeg',
  fileName: 'cropped.jpg',
};

describe('uiSlice', () => {
  describe('initial state', () => {
    it('starts with default values', () => {
      const state = createTestStore().getState();
      expect(state.pendingPantryScrollToTop).toBe(false);
      expect(state.tutorialResetGeneration).toBe(0);
      expect(state.pendingCroppedImage).toBeNull();
      expect(state.pendingItemImages).toBeNull();
    });
  });

  describe('pantry scroll hand-off', () => {
    it('setPendingPantryScrollToTop toggles the flag', () => {
      const store = createTestStore();
      store.getState().setPendingPantryScrollToTop(true);
      expect(store.getState().pendingPantryScrollToTop).toBe(true);
    });
  });

  describe('crop hand-off', () => {
    it('setPendingCroppedImage stores the image', () => {
      const store = createTestStore();
      store.getState().setPendingCroppedImage(image);
      expect(store.getState().pendingCroppedImage).toEqual(image);
    });

    it('takePendingCroppedImage returns the image and clears it', () => {
      const store = createTestStore();
      store.getState().setPendingCroppedImage(image);
      expect(store.getState().takePendingCroppedImage()).toEqual(image);
      expect(store.getState().pendingCroppedImage).toBeNull();
    });

    // Two screens must not both collect one crop, so a second take is empty.
    it('takePendingCroppedImage returns null when nothing is pending', () => {
      const store = createTestStore();
      expect(store.getState().takePendingCroppedImage()).toBeNull();
    });
  });

  describe('item image hand-off', () => {
    it('setPendingItemImages stores and clears the list', () => {
      const store = createTestStore();
      store
        .getState()
        .setPendingItemImages([{ ...image, perspective: 'front' }]);
      expect(store.getState().pendingItemImages).toEqual([
        { ...image, perspective: 'front' },
      ]);
      store.getState().setPendingItemImages(null);
      expect(store.getState().pendingItemImages).toBeNull();
    });
  });

  describe('tutorial reset signal', () => {
    it('bumpTutorialResetGeneration increments the counter', () => {
      const store = createTestStore();
      store.getState().bumpTutorialResetGeneration();
      store.getState().bumpTutorialResetGeneration();
      expect(store.getState().tutorialResetGeneration).toBe(2);
    });
  });
});
