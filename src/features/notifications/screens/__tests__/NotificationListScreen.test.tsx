import React from 'react';
import type { ApolloClient } from '@apollo/client';
import { FlashList } from '@shopify/flash-list';
import { act, fireEvent, screen } from '@testing-library/react-native';
import { t } from '#/i18n';
import { useStore } from '#store';
import { isRecord } from '#/utils/isRecord';
import { kitTestIDs } from '#components/testIDs';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { screenShows, withDeadline } from '#/test-utils/cacheWaits';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  GetNotificationsDocument,
  type NotificationSummaryQuery,
} from '#features/notifications/graphql/notifications.generated';
import {
  DeleteNotificationDocument,
  MarkNotificationAsReadDocument,
} from '#features/notifications/graphql/notificationMutations.generated';
import {
  DeleteMultipleNotificationsDocument,
  MarkAllNotificationsAsReadDocument,
} from '#features/notifications/graphql/bulkNotificationMutations.generated';
import type { UseNotificationsOnLaunch_NotificationFragment } from '#features/notifications/hooks/useNotificationsOnLaunch.generated';
import { notificationsTestIDs } from '#features/notifications/testIDs';
import { NotificationListScreen } from '../NotificationListScreen';

jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#hooks/performance/useScreenTransition');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const ME = 'user-1';

let log = operationLog();

type Row = UseNotificationsOnLaunch_NotificationFragment;

/** A notification as the server sends it, sent now unless it says when. */
const row = (overrides: Partial<Row> & Pick<Row, 'id'>): Row => ({
  __typename: 'Notification',
  type: NotificationType.HomeJoined,
  isAuthoredContent: false,
  status: NotificationStatus.Sent,
  priority: Priority.Normal,
  title: null,
  message: null,
  payload: {},
  data: null,
  category: NotificationCategory.Home,
  sentAt: new Date().toISOString(),
  expiresAt: null,
  sourceId: null,
  sourceType: null,
  pantryItemId: null,
  actionUrl: null,
  readAt: null,
  ...overrides,
});

const homeJoined = (overrides: Partial<Row> = {}) =>
  row({ id: 'joined', ...overrides });

const lowStock = (overrides: Partial<Row> = {}) =>
  row({
    id: 'low',
    type: NotificationType.LowStock,
    category: NotificationCategory.Pantry,
    data: {
      __typename: 'LowStockNotificationData',
      itemName: 'Milk',
      currentQuantity: 1,
    },
    ...overrides,
  });

const invitation = (overrides: Partial<Row> = {}) =>
  row({
    id: 'invite',
    type: NotificationType.HomeInvitation,
    data: {
      __typename: 'HomeInvitationNotificationData',
      homeName: 'Beach house',
      inviterName: 'Sam',
      inviteId: 'invite-1',
      token: 'token-1',
    },
    ...overrides,
  });

type Edge = NonNullable<
  NonNullable<
    NonNullable<
      MockDataFor<typeof GetNotificationsDocument>['me']
    >['notificationsConnection']
  >['edges']
>[number];

const edgeOf = (node: Row): Edge => ({ __typename: 'NotificationEdge', node });

interface Page {
  category?: NotificationCategory;
  after?: string;
  hasNextPage?: boolean;
  error?: Error;
}

/** One page of the feed: the answer to the request naming its category and cursor. */
const feed = (
  rows: Row[],
  { category, after, hasNextPage = false, error }: Page = {},
) =>
  recordMock(GetNotificationsDocument, {
    match: variables =>
      (isRecord(variables.filter) ? variables.filter.category : undefined) ===
        category && variables.after === after,
    error,
    data: {
      notificationSummary: {
        __typename: 'NotificationSummary',
        id: ME,
        unreadCount: rows.filter(r => r.status === NotificationStatus.Sent)
          .length,
        hasUrgent: false,
      },
      me: {
        __typename: 'User',
        id: ME,
        notificationsConnection: {
          __typename: 'NotificationConnection',
          totalCount: rows.length,
          edges: rows.map(edgeOf),
          pageInfo: {
            __typename: 'PageInfo',
            hasNextPage,
            endCursor: hasNextPage ? `after-${rows.length}` : null,
          },
        },
      },
    },
  });

/** The badge as the server states it after a write. */
const summary: NotificationSummaryQuery['notificationSummary'] = {
  __typename: 'NotificationSummary',
  id: ME,
  unreadCount: 0,
  hasUrgent: false,
};

const markedRead = (id: string, { held = false } = {}) =>
  recordMock(MarkNotificationAsReadDocument, {
    held,
    data: {
      markNotificationAsRead: {
        __typename: 'MarkNotificationAsReadPayload',
        notification: {
          __typename: 'Notification',
          id,
          status: NotificationStatus.Read,
        },
        notificationSummary: summary,
      },
    },
  });

const deleted = () =>
  recordMock(DeleteNotificationDocument, {
    data: {
      deleteNotification: {
        __typename: 'DeleteNotificationPayload',
        converged: false,
        notificationSummary: summary,
      },
    },
  });

const deletedMany = () =>
  recordMock(DeleteMultipleNotificationsDocument, {
    data: {
      deleteMultipleNotifications: {
        __typename: 'DeleteMultipleNotificationsPayload',
        summary: { __typename: 'BulkSummary', total: 1 },
        notificationSummary: summary,
      },
    },
  });

const allMarkedRead = () =>
  recordMock(MarkAllNotificationsAsReadDocument, {
    data: {
      markAllNotificationsAsRead: {
        __typename: 'MarkAllNotificationsAsReadPayload',
        summary: { __typename: 'BulkSummary', total: 1 },
        notificationSummary: summary,
      },
    },
  });

/** The screen once its first page landed; hands back its client. */
async function openList(
  pages: ReturnType<typeof recordMock>[],
  answers: ReturnType<typeof recordMock>[] = [],
) {
  const { client } = renderWithApollo(<NotificationListScreen />, {
    links: [log.link],
    operationMocks: [...pages, ...answers].map(answer => answer.mock),
  });
  await act(() => log.landed(GetNotificationsDocument));
  return client;
}

const UNFILTERED = { filter: undefined, first: 30 };

/** Resolves once the unfiltered feed holds `count` notifications. */
const feedHolds = (client: ApolloClient, count: number) =>
  screenShows(
    client,
    { query: GetNotificationsDocument, variables: UNFILTERED },
    () =>
      client.readQuery({
        query: GetNotificationsDocument,
        variables: UNFILTERED,
      })?.me?.notificationsConnection.edges.length,
    seen => seen === count,
  );

/** Resolves once `fn` is called, failing with `what` if it never is. */
const calledOnce = (fn: jest.Mock, what: string) =>
  withDeadline(
    done => {
      fn.mockImplementation(() => done());
      return () => fn.mockImplementation(() => undefined);
    },
    () => `${what} never happened`,
  );

const goOffline = () =>
  act(() => {
    useStore.setState({ isOnline: false, apiReachable: false });
  });

const pickCategory = (category: NotificationCategory) =>
  fireEvent.press(
    screen.getByTestId(
      kitTestIDs.filterTab(notificationsTestIDs.filterTabs, category),
    ),
  );

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    user: {
      id: ME,
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    isOnline: true,
    apiReachable: null,
  });
});

describe('the feed', () => {
  it('shows each notification under the day it came', async () => {
    await openList([feed([homeJoined()])]);

    expect(screen.getByText(t('labels.today'))).toBeTruthy();
    expect(
      screen.getByText(t('notifications.copy.title.HOME_JOINED')),
    ).toBeTruthy();
  });

  it('counts the unread urgent ones above the list', async () => {
    await openList([feed([homeJoined({ priority: Priority.Urgent })])]);

    expect(
      screen.getByText(t('notifications.urgentUnread', { count: 1 })),
    ).toBeTruthy();
  });

  it('says there are none when the server holds none', async () => {
    await openList([feed([])]);

    expect(screen.getByText(t('empty.noNotifications'))).toBeTruthy();
    expect(screen.queryByText(t('notifications.markAllRead'))).toBeNull();
  });

  it('says the read failed, not that there are none', async () => {
    await openList([feed([], { error: new Error('Server unavailable') })]);

    expect(screen.getByTestId(kitTestIDs.stateError)).toBeTruthy();
    expect(screen.queryByText(t('empty.noNotifications'))).toBeNull();
  });

  it('asks for the next page at the end of the list', async () => {
    const next = feed([lowStock()], { after: 'after-1' });
    const client = await openList([
      feed([homeJoined()], { hasNextPage: true }),
      next,
    ]);

    fireEvent(screen.UNSAFE_getByType(FlashList), 'endReached');
    await act(() => feedHolds(client, 2));

    expect(next.fired).toHaveLength(1);
    expect(
      screen.getByText(t('notifications.copy.title.LOW_STOCK')),
    ).toBeTruthy();
  });
});

describe('a category', () => {
  it('is asked of the server', async () => {
    const pantry = feed([lowStock()], {
      category: NotificationCategory.Pantry,
    });
    await openList([feed([homeJoined()]), pantry]);

    pickCategory(NotificationCategory.Pantry);
    await act(() => log.landed(GetNotificationsDocument, 2));

    expect(pantry.fired).toHaveLength(1);
    expect(
      screen.getByText(t('notifications.copy.title.LOW_STOCK')),
    ).toBeTruthy();
    expect(
      screen.queryByText(t('notifications.copy.title.HOME_JOINED')),
    ).toBeNull();
  });

  describe('offline', () => {
    it('narrows what the device holds, saying more may be on the server', async () => {
      await openList([feed([homeJoined(), lowStock()], { hasNextPage: true })]);
      goOffline();

      pickCategory(NotificationCategory.Pantry);

      expect(
        screen.getByText(t('notifications.copy.title.LOW_STOCK')),
      ).toBeTruthy();
      expect(screen.getByText(t('dataState.partialTitle'))).toBeTruthy();
    });

    it('says it is offline when the device holds none, not that there are none', async () => {
      await openList([feed([homeJoined()], { hasNextPage: true })]);
      goOffline();

      pickCategory(NotificationCategory.Pantry);

      expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();
      expect(screen.queryByText(t('empty.noNotifications'))).toBeNull();
      expect(screen.queryByText(t('dataState.partialTitle'))).toBeNull();
    });
  });
});

describe('pressing a notification', () => {
  it('marks it read', async () => {
    const read = markedRead('joined');
    await openList([feed([homeJoined()])], [read]);

    fireEvent.press(
      screen.getByText(t('notifications.copy.title.HOME_JOINED')),
    );
    await act(() => log.landed(MarkNotificationAsReadDocument));

    expect(read.fired).toEqual([{ input: { id: 'joined' } }]);
  });

  it('opens its detail at once, before the server answers the read', async () => {
    const read = markedRead('joined', { held: true });
    await openList([feed([homeJoined()])], [read]);
    const opened = calledOnce(
      mockNav.toNotificationDetail,
      'opening the detail',
    );

    fireEvent.press(
      screen.getByText(t('notifications.copy.title.HOME_JOINED')),
    );
    await opened;

    expect(mockNav.toNotificationDetail).toHaveBeenCalledWith({
      id: 'joined',
      notification: expect.objectContaining({ id: 'joined' }),
    });
    read.release();
    await act(() => log.landed(MarkNotificationAsReadDocument));
  });

  it('opens nothing for a pantry notification', async () => {
    await openList([
      feed([
        lowStock({ status: NotificationStatus.Read }),
        homeJoined({ status: NotificationStatus.Read }),
      ]),
    ]);
    const opened = calledOnce(
      mockNav.toNotificationDetail,
      'opening the detail',
    );

    fireEvent.press(screen.getByText(t('notifications.copy.title.LOW_STOCK')));
    fireEvent.press(
      screen.getByText(t('notifications.copy.title.HOME_JOINED')),
    );
    await opened;

    expect(mockNav.toNotificationDetail).toHaveBeenCalledTimes(1);
    expect(mockNav.toNotificationDetail).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'joined' }),
    );
  });

  it('offers to answer an invitation at once', async () => {
    const read = markedRead('invite', { held: true });
    await openList([feed([invitation()])], [read]);

    fireEvent.press(
      screen.getByText(t('notifications.copy.title.HOME_INVITATION')),
    );

    expect(
      screen.getByText(t('labels.invitedBy', { name: 'Sam' })),
    ).toBeVisible();
    expect(mockNav.toNotificationDetail).not.toHaveBeenCalled();
    read.release();
    await act(() => log.landed(MarkNotificationAsReadDocument));
  });
});

describe('the list actions', () => {
  it('dismiss one notification', async () => {
    const dismissed = deleted();
    await openList([feed([homeJoined()])], [dismissed]);

    fireEvent.press(screen.getByLabelText(t('notifications.dismissA11y')));
    await act(() => log.landed(DeleteNotificationDocument));

    expect(dismissed.fired).toEqual([{ input: { id: 'joined' } }]);
  });

  it('mark them all read', async () => {
    const markAll = allMarkedRead();
    await openList([feed([homeJoined()])], [markAll]);

    fireEvent.press(screen.getByText(t('notifications.markAllRead')));
    await act(() => log.landed(MarkAllNotificationsAsReadDocument));

    expect(markAll.fired).toHaveLength(1);
  });

  it('clear only the read ones', async () => {
    const cleared = deletedMany();
    await openList(
      [
        feed([
          lowStock({ status: NotificationStatus.Read }),
          homeJoined({ status: NotificationStatus.Sent }),
        ]),
      ],
      [cleared],
    );

    fireEvent.press(screen.getByText(t('labels.clearRead')));
    await act(() => log.landed(DeleteMultipleNotificationsDocument));

    expect(cleared.fired).toEqual([{ input: { ids: ['low'] } }]);
  });

  it('open the settings', async () => {
    await openList([feed([])]);

    fireEvent.press(screen.getByLabelText(t('a11y.notificationSettings')));

    expect(mockNav.toNotificationSettings).toHaveBeenCalled();
  });
});
