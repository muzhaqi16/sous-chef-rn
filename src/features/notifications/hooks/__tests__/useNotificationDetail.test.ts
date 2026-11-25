import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { useStore } from '#store';
import { NotificationDetailDocument } from '../useNotificationDetail.generated';
import { useNotificationDetail } from '../useNotificationDetail';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
  useStore.setState({ isOnline: true, apiReachable: null });
});

// A push opens the detail with an id alone, often before the feed holds it.
describe('useNotificationDetail', () => {
  it('asks the server for a notification the device does not hold', async () => {
    const answer = recordMock(NotificationDetailDocument, {
      data: { notification: { __typename: 'Notification', id: 'n1' } },
    });
    const { result } = renderHookWithApollo(() => useNotificationDetail('n1'), {
      operationMocks: [answer.mock],
    });
    await drainTimers();

    expect(answer.fired).toHaveLength(1);
    expect(result.current.notification?.id).toBe('n1');
    expect(result.current.state).toBe('ready');
  });

  it('says it is not available offline, never that it was not found', async () => {
    useStore.setState({ isOnline: false, apiReachable: null });
    const miss = recordMock(NotificationDetailDocument, {
      error: new Error('Network request failed'),
    });
    const { result } = renderHookWithApollo(() => useNotificationDetail('n1'), {
      operationMocks: [miss.mock],
    });
    await drainTimers();

    expect(result.current.notification).toBeUndefined();
    expect(result.current.state).toBe('offline');
  });

  it('says not found when the server holds no such notification', async () => {
    const none = recordMock(NotificationDetailDocument, {
      data: { notification: null },
    });
    const { result } = renderHookWithApollo(
      () => useNotificationDetail('gone'),
      { operationMocks: [none.mock] },
    );
    await drainTimers();

    expect(result.current.notification).toBeUndefined();
    expect(result.current.state).toBe('empty');
  });
});
