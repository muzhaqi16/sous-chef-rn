'use no memo';
import { renderHook } from '@testing-library/react-native';
import { useAllPendingInvites } from '../useAllPendingInvites';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

const mockFetchShoppingList = jest.fn();
const mockFetchHome = jest.fn();
jest.mock('#generated', () => ({
  useMyShoppingListInvitesLazyQuery: () => [
    mockFetchShoppingList,
    { data: null, error: undefined },
  ],
  useGetMyPendingInvitesLazyQuery: () => [
    mockFetchHome,
    { data: null, error: undefined },
  ],
  NotificationType: {
    CollaborationInvite: 'COLLABORATION_INVITE',
    HomeInvitation: 'HOME_INVITATION',
  },
}));
jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: any) =>
    selector({ addMultipleNotifications: jest.fn() }),
}));
jest.mock('#store/slices/notificationSlice', () => ({
  NotificationCategory: { COLLABORATION: 'COLLABORATION', MEMBERSHIP: 'MEMBERSHIP' },
  NotificationPriority: { HIGH: 'HIGH' },
}));
jest.mock('#hooks/performance/useDeferredCallback', () => ({
  useDeferredCallback: (fn: () => void, enabled: boolean) => {
    if (enabled) fn();
  },
}));
jest.mock('#hooks/apollo/useApolloErrorLogger', () => ({
  useApolloErrorLogger: jest.fn(),
}));

describe('useAllPendingInvites', () => {
  beforeEach(() => jest.clearAllMocks());

  it('does not fetch when userId is undefined', () => {
    renderHook(() => useAllPendingInvites(undefined));
    expect(mockFetchShoppingList).not.toHaveBeenCalled();
    expect(mockFetchHome).not.toHaveBeenCalled();
  });

  it('fetches invitations when userId is provided', () => {
    renderHook(() => useAllPendingInvites('user-1'));
    expect(mockFetchShoppingList).toHaveBeenCalled();
    expect(mockFetchHome).toHaveBeenCalled();
    expect(console.log).toHaveBeenCalledWith(
      '📬 [useAllPendingInvites] Deferred invitation queries started',
    );
  });
});
