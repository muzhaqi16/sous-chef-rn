import { renderHook, act } from '@testing-library/react-native';
import { alertService } from '#/services/alertService';
import { useHomeInvitations } from '../useHomeInvitations';

const mockInviteUserMutation = jest.fn();
const mockJoinHomeByCodeMutation = jest.fn();
const mockGetHomeByJoinCode = jest.fn();

jest.mock('#generated', () => ({
  ...jest.requireActual('#generated'),
  useInviteToHomeMutation: jest.fn(() => [
    mockInviteUserMutation,
    { loading: false },
  ]),
  useJoinHomeByCodeMutation: jest.fn(() => [
    mockJoinHomeByCodeMutation,
    { loading: false },
  ]),
  useGetHomeByJoinCodeLazyQuery: jest.fn(() => [
    mockGetHomeByJoinCode,
    { loading: false, data: undefined },
  ]),
}));

jest.mock('#/services/errorService', () => ({
  useErrorService: () => ({
    handleApolloError: jest.fn(() => ({ message: 'Error occurred' })),
  }),
}));

jest.mock('#/utils/connectionUtils', () => ({
  normalizeHome: jest.fn((home: any) => home),
}));

jest.mock('#/apollo/utils/cacheUpdaters', () => ({
  createAddToParentConnectionUpdater: jest.fn(() => jest.fn()),
}));

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

const createOptions = () => ({
  homes: [] as any[],
  refetch: jest.fn().mockResolvedValue(undefined),
  setDefaultHome: jest.fn().mockResolvedValue(true),
  setSelectedHomeId: jest.fn(),
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useHomeInvitations', () => {
  it('returns invitation functions and loading states', () => {
    const { result } = renderHook(() => useHomeInvitations(createOptions()));

    expect(typeof result.current.inviteUserToHome).toBe('function');
    expect(typeof result.current.joinHomeByCode).toBe('function');
    expect(typeof result.current.previewHomeByCode).toBe('function');
    expect(result.current.inviting).toBe(false);
    expect(result.current.joiningByCode).toBe(false);
    expect(result.current.loadingPreview).toBe(false);
    expect(result.current.previewHome).toBeNull();
  });

  describe('inviteUserToHome', () => {
    it('calls mutation with trimmed email and default role', async () => {
      mockInviteUserMutation.mockResolvedValue({
        data: { inviteToHome: { homeInvite: { id: 'invite-1' } } },
      });

      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      await act(async () => {
        await result.current.inviteUserToHome('home-1', '  user@test.com  ');
      });

      expect(mockInviteUserMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            homeId: 'home-1',
            email: 'user@test.com',
            role: 'MEMBER',
          },
        },
      });
    });

    it('uses specified role', async () => {
      mockInviteUserMutation.mockResolvedValue({
        data: { inviteToHome: { homeInvite: { id: 'invite-1' } } },
      });

      const { MembershipRole } = jest.requireMock('#generated');
      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      await act(async () => {
        await result.current.inviteUserToHome(
          'home-1',
          'admin@test.com',
          MembershipRole.Admin,
        );
      });

      expect(mockInviteUserMutation).toHaveBeenCalledWith({
        variables: {
          input: {
            homeId: 'home-1',
            email: 'admin@test.com',
            role: 'ADMIN',
          },
        },
      });
    });

    it('returns mutation data on success', async () => {
      const mockData = {
        inviteToHome: {
          homeInvite: { id: 'invite-1', email: 'user@test.com' },
        },
      };
      mockInviteUserMutation.mockResolvedValue({ data: mockData });

      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.inviteUserToHome(
          'home-1',
          'user@test.com',
        );
      });

      expect(returnValue).toEqual(mockData);
    });
  });

  describe('joinHomeByCode', () => {
    it('shows alert for empty join code', async () => {
      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      let success: any;
      await act(async () => {
        success = await result.current.joinHomeByCode('   ');
      });

      expect(success).toBe(false);
      expect(alertService.alert).toHaveBeenCalledWith(
        'Error',
        'Please enter a join code',
      );
      expect(mockJoinHomeByCodeMutation).not.toHaveBeenCalled();
    });

    it('calls mutation with trimmed code and returns membership', async () => {
      const membership = { homeId: 'home-1', role: 'MEMBER' };
      mockJoinHomeByCodeMutation.mockResolvedValue({
        data: { joinHomeByCode: { membership } },
      });

      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.joinHomeByCode('  ABC123  ');
      });

      expect(mockJoinHomeByCodeMutation).toHaveBeenCalledWith({
        variables: { joinCode: 'ABC123' },
      });
      expect(returnValue).toEqual(membership);
    });

    it('returns false when no membership returned', async () => {
      mockJoinHomeByCodeMutation.mockResolvedValue({
        data: { joinHomeByCode: { membership: null } },
      });

      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.joinHomeByCode('ABC123');
      });

      expect(returnValue).toBe(false);
    });
  });

  describe('previewHomeByCode', () => {
    it('returns null for empty code', async () => {
      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('  ');
      });

      expect(returnValue).toBeNull();
      expect(mockGetHomeByJoinCode).not.toHaveBeenCalled();
    });

    it('queries with trimmed code and returns home data', async () => {
      const homeData = { id: 'home-1', name: 'Test Home' };
      mockGetHomeByJoinCode.mockResolvedValue({
        data: { homeByJoinCode: homeData },
      });

      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('  XYZ789  ');
      });

      expect(mockGetHomeByJoinCode).toHaveBeenCalledWith({
        variables: { joinCode: 'XYZ789' },
      });
      expect(returnValue).toEqual(homeData);
    });

    it('returns null when query returns no home', async () => {
      mockGetHomeByJoinCode.mockResolvedValue({
        data: { homeByJoinCode: null },
      });

      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('INVALID');
      });

      expect(returnValue).toBeNull();
    });

    it('returns null on error', async () => {
      mockGetHomeByJoinCode.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useHomeInvitations(createOptions()));

      let returnValue: any;
      await act(async () => {
        returnValue = await result.current.previewHomeByCode('ABC123');
      });

      expect(returnValue).toBeNull();
    });
  });
});
