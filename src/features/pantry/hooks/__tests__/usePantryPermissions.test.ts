import { renderHook } from '@testing-library/react-native';
import { MembershipRole } from '#/graphql/generated/schemaTypes';
import { usePantryPermissions } from '../usePantryPermissions';

jest.mock('#features/pantry/hooks/useCurrentHome');

import { useCurrentHome } from '#features/pantry/hooks/useCurrentHome';

const mockCurrentHome = useCurrentHome as jest.MockedFunction<
  typeof useCurrentHome
>;

const withHome = (currentHome: unknown) => {
  mockCurrentHome.mockReturnValue({ currentHome } as ReturnType<
    typeof useCurrentHome
  >);
};

describe('usePantryPermissions', () => {
  beforeEach(() => jest.clearAllMocks());

  // "Unknown" must not read as "denied". Failing closed here rendered UI that
  // looked live but did nothing — the tab bar's add button no-opped silently,
  // swipe actions disappeared, PantrySettings' create button sat disabled.
  describe('membership unknown → permissive (API is the enforcement point)', () => {
    it('allows everything while the home has not resolved yet', () => {
      withHome(undefined);
      const { result } = renderHook(() => usePantryPermissions());
      expect(result.current).toEqual({
        canView: true,
        canAddItems: true,
        canEditItems: true,
        canManagePantry: true,
      });
    });

    it('allows everything when the cached home carries no myMembership', () => {
      withHome({ id: 'h1' });
      const { result } = renderHook(() => usePantryPermissions());
      expect(result.current.canAddItems).toBe(true);
      expect(result.current.canEditItems).toBe(true);
    });
  });

  // A membership that actually loaded still restricts normally — the
  // permissive default above must not leak into a real denial.
  describe('membership loaded → the role decides', () => {
    it('gives an owner full permissions', () => {
      withHome({ id: 'h1', myMembership: { role: MembershipRole.Owner } });
      const { result } = renderHook(() => usePantryPermissions());
      expect(result.current.canAddItems).toBe(true);
      expect(result.current.canManagePantry).toBe(true);
    });

    it('denies a guest that was not explicitly granted access', () => {
      withHome({ id: 'h1', myMembership: { role: MembershipRole.Guest } });
      const { result } = renderHook(() => usePantryPermissions());
      expect(result.current).toEqual({
        canView: false,
        canAddItems: false,
        canEditItems: false,
        canManagePantry: false,
      });
    });

    it('honours an explicit grant on a guest', () => {
      withHome({
        id: 'h1',
        myMembership: { role: MembershipRole.Guest, canAddItems: true },
      });
      const { result } = renderHook(() => usePantryPermissions());
      expect(result.current.canAddItems).toBe(true);
      expect(result.current.canEditItems).toBe(false);
    });

    it('honours an explicit denial on a member', () => {
      withHome({
        id: 'h1',
        myMembership: { role: MembershipRole.Member, canAddItems: false },
      });
      const { result } = renderHook(() => usePantryPermissions());
      expect(result.current.canAddItems).toBe(false);
      // Members keep permissive defaults for anything not explicitly denied.
      expect(result.current.canEditItems).toBe(true);
    });
  });
});
