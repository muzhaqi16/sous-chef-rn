import { createTestStore } from '#/test-utils/createTestStore';
import { OnBoardingSteps, type DeepLinkAction } from '../navigationSlice';

// Mock authSlice dependencies
jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

describe('navigationSlice', () => {
  describe('initial state', () => {
    it('starts with null values', () => {
      const store = createTestStore();
      const state = store.getState();
      expect(state.onBoardingStep).toBeNull();
      expect(state.selectedHomeId).toBeNull();
      expect(state.selectedPantryId).toBeNull();
      expect(state.selectedShoppingListId).toBeNull();
      expect(state.selectedMealPlanId).toBeNull();
      expect(state.hasInitializedHomeData).toBe(false);
      expect(state.isHomeSelectionReady).toBe(false);
      expect(state.pendingDeepLinkAction).toBeNull();
    });
  });

  describe('setOnBoardingStep', () => {
    it('sets the onboarding step', () => {
      const store = createTestStore();
      store.getState().setOnBoardingStep(OnBoardingSteps.createHome);
      expect(store.getState().onBoardingStep).toBe(OnBoardingSteps.createHome);
    });

    it('can be set to null', () => {
      const store = createTestStore();
      store.getState().setOnBoardingStep(OnBoardingSteps.complete);
      store.getState().setOnBoardingStep(null);
      expect(store.getState().onBoardingStep).toBeNull();
    });
  });

  describe('resource selection', () => {
    it('sets selectedHomeId', () => {
      const store = createTestStore();
      store.getState().setSelectedHomeId('home-1');
      expect(store.getState().selectedHomeId).toBe('home-1');
    });

    it('sets selectedPantryId', () => {
      const store = createTestStore();
      store.getState().setSelectedPantryId('pantry-1');
      expect(store.getState().selectedPantryId).toBe('pantry-1');
    });

    it('sets selectedShoppingListId', () => {
      const store = createTestStore();
      store.getState().setSelectedShoppingListId('list-1');
      expect(store.getState().selectedShoppingListId).toBe('list-1');
    });

    it('sets selectedMealPlanId', () => {
      const store = createTestStore();
      store.getState().setSelectedMealPlanId('plan-1');
      expect(store.getState().selectedMealPlanId).toBe('plan-1');
    });
  });

  describe('setHomeAndPantry', () => {
    it('atomically sets home and pantry', () => {
      const store = createTestStore();
      store.getState().setHomeAndPantry('home-2', 'pantry-2');
      expect(store.getState().selectedHomeId).toBe('home-2');
      expect(store.getState().selectedPantryId).toBe('pantry-2');
    });
  });

  describe('initialization flags', () => {
    it('sets hasInitializedHomeData', () => {
      const store = createTestStore();
      store.getState().setHasInitializedHomeData(true);
      expect(store.getState().hasInitializedHomeData).toBe(true);
    });

    it('sets isHomeSelectionReady', () => {
      const store = createTestStore();
      store.getState().setIsHomeSelectionReady(true);
      expect(store.getState().isHomeSelectionReady).toBe(true);
    });

    it('sets isPantryQueryComplete', () => {
      const store = createTestStore();
      store.getState().setIsPantryQueryComplete(true);
      expect(store.getState().isPantryQueryComplete).toBe(true);
    });
  });

  describe('user navigation state', () => {
    it('sets user navigation state', () => {
      const store = createTestStore();
      store.getState().setUserNavigationState('user-1', { lastRoute: '/home' });
      expect(store.getState().getUserNavigationState('user-1')).toEqual({
        lastRoute: '/home',
      });
    });

    it('merges user navigation state', () => {
      const store = createTestStore();
      store.getState().setUserNavigationState('user-1', { lastRoute: '/home' });
      store.getState().setUserNavigationState('user-1', { isNewUser: true });
      expect(store.getState().getUserNavigationState('user-1')).toEqual({
        lastRoute: '/home',
        isNewUser: true,
      });
    });

    it('returns null for unknown user', () => {
      const store = createTestStore();
      expect(store.getState().getUserNavigationState('unknown')).toBeNull();
    });

    it('clears user navigation state', () => {
      const store = createTestStore();
      store.getState().setUserNavigationState('user-1', { lastRoute: '/home' });
      store.getState().clearUserNavigationState('user-1');
      expect(store.getState().getUserNavigationState('user-1')).toBeNull();
    });
  });

  describe('deep link actions', () => {
    it('sets pending deep link action', () => {
      const action: DeepLinkAction = {
        type: 'email_verification',
        token: 'abc',
        timestamp: Date.now(),
      };
      const store = createTestStore();
      store.getState().setPendingDeepLinkAction(action);
      expect(store.getState().pendingDeepLinkAction).toEqual(action);
    });

    it('clears pending deep link action', () => {
      const store = createTestStore();
      store.getState().setPendingDeepLinkAction({
        type: 'password_reset',
        token: 'x',
        timestamp: Date.now(),
      });
      store.getState().clearPendingDeepLinkAction();
      expect(store.getState().pendingDeepLinkAction).toBeNull();
    });
  });
});
