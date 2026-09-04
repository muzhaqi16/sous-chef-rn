import { renderHookWithApollo } from '#/test-utils/apolloMockProvider';
import { useNotificationActionData } from '#features/notifications/hooks/useNotificationActionData';

const mockSyncDelete = jest.fn();
jest.mock('#features/notifications/hooks/useNotificationSync', () => ({
  useNotificationSync: () => ({ syncDelete: mockSyncDelete }),
}));

/**
 * Removing a notification only from the cache is not a terminal state: the
 * server still has it, so it returns on the next cold start — and an invite
 * notification that returns without its token can never be actioned again.
 */
describe('useNotificationActionData', () => {
  beforeEach(() => jest.clearAllMocks());

  it('removes a notification durably rather than only locally', async () => {
    const { result } = renderHookWithApollo(() => useNotificationActionData(), {
      operationMocks: [],
    });

    result.current.removeNotification('notif-1');

    expect(mockSyncDelete).toHaveBeenCalledWith('notif-1');
  });
});
