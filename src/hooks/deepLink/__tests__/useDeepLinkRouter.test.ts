import { renderHook } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import type { DeepLinkAction } from '#store/slices/navigationSlice';
import { useDeepLinkRouter } from '../useDeepLinkRouter';
import { getI18n } from '#/i18n/config';
import { memoryIntents } from '#/test-utils/memoryPlatform';

const mockToJoinHomeByCode = jest.spyOn(memoryIntents(), 'toJoinHomeByCode');
const mockToJoinByShareCode = jest.spyOn(memoryIntents(), 'toJoinByShareCode');
const mockToRecipeDetail = jest.spyOn(memoryIntents(), 'toRecipeDetail');

let mockMainApp = true;
jest.mock('#hooks/navigation/useNavigationGuards', () => ({
  useIsMainApp: () => mockMainApp,
}));

const mockClearPending = jest.fn();
let mockIsHydrated = true;
let mockSignedIn = true;
let mockPending: DeepLinkAction | null = null;

jest.mock('#store/useAppStore', () => ({
  useAppStore: <T>(selector: (state: RootState) => T): T =>
    selector({
      user: mockSignedIn
        ? { id: 'u1', email: 'a@b.c', emailVerified: true, onBoarded: true }
        : null,
      accessToken: mockSignedIn ? 'token' : null,
      pendingDeepLinkAction: mockPending,
      clearPendingDeepLinkAction: mockClearPending,
    } as Partial<RootState> as RootState),
  useIsHydrated: () => mockIsHydrated,
  useIsSignedIn: () => mockSignedIn,
}));

describe('useDeepLinkRouter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsHydrated = true;
    mockSignedIn = true;
    mockPending = null;
    mockMainApp = true;
  });

  describe("a recipe tapped on onboarding's payoff", () => {
    it('waits for the main app, then opens it', () => {
      mockMainApp = false;
      mockPending = {
        type: 'open_recipe',
        recipeId: 'r1',
        timestamp: Date.now(),
      };
      const { rerender } = renderHook(() => useDeepLinkRouter());
      expect(mockToRecipeDetail).not.toHaveBeenCalled();
      expect(mockClearPending).not.toHaveBeenCalled();

      mockMainApp = true;
      rerender({});

      expect(mockToRecipeDetail).toHaveBeenCalledWith({ recipeId: 'r1' });
      expect(mockClearPending).toHaveBeenCalled();
    });

    it('is dropped without a word once stale', () => {
      const { toastService } = jest.requireMock('#/services/toastService');
      mockPending = {
        type: 'open_recipe',
        recipeId: 'r1',
        timestamp: Date.now() - 10 * 60 * 1000,
      };

      renderHook(() => useDeepLinkRouter());

      expect(mockToRecipeDetail).not.toHaveBeenCalled();
      expect(toastService.warning).not.toHaveBeenCalled();
      expect(mockClearPending).toHaveBeenCalled();
    });
  });

  it('still replays a join link during onboarding', () => {
    mockMainApp = false;
    mockPending = { type: 'join_home', code: 'HOME123', timestamp: Date.now() };

    renderHook(() => useDeepLinkRouter());

    expect(mockToJoinHomeByCode).toHaveBeenCalledWith('HOME123');
  });

  it('replays a pending join_list once authenticated', () => {
    mockPending = { type: 'join_list', code: 'LIST123', timestamp: Date.now() };

    renderHook(() => useDeepLinkRouter());

    expect(mockToJoinByShareCode).toHaveBeenCalledWith('LIST123');
    expect(mockClearPending).toHaveBeenCalled();
  });

  it('replays a pending join_home once authenticated', () => {
    mockPending = { type: 'join_home', code: 'HOME123', timestamp: Date.now() };

    renderHook(() => useDeepLinkRouter());

    expect(mockToJoinHomeByCode).toHaveBeenCalledWith('HOME123');
    expect(mockClearPending).toHaveBeenCalled();
  });

  it('keeps the action queued while logged out', () => {
    mockSignedIn = false;
    mockPending = { type: 'join_home', code: 'HOME123', timestamp: Date.now() };

    renderHook(() => useDeepLinkRouter());

    expect(mockToJoinHomeByCode).not.toHaveBeenCalled();
    expect(mockClearPending).not.toHaveBeenCalled();
  });

  it('waits for hydration', () => {
    mockIsHydrated = false;
    mockPending = { type: 'join_list', code: 'LIST123', timestamp: Date.now() };

    renderHook(() => useDeepLinkRouter());

    expect(mockToJoinByShareCode).not.toHaveBeenCalled();
    expect(mockClearPending).not.toHaveBeenCalled();
  });

  it('discards a stale action with localized copy', () => {
    const { toastService } = jest.requireMock('#/services/toastService');
    mockPending = {
      type: 'join_home',
      code: 'HOME123',
      timestamp: Date.now() - 6 * 60 * 1000,
    };

    renderHook(() => useDeepLinkRouter());

    expect(mockToJoinHomeByCode).not.toHaveBeenCalled();
    expect(toastService.warning).toHaveBeenCalledWith(
      getI18n().t('joinLink.staleHome'),
    );
    expect(mockClearPending).toHaveBeenCalled();
  });
});
