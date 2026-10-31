'use no memo';
import React from 'react';
import { GraphQLError } from 'graphql';
import { act, screen, userEvent } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { t } from '#/i18n';
import {
  renderWithApollo,
  type MockDataFor,
  type MockedResponse,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import {
  NotificationCategory,
  NotificationStatus,
  NotificationType,
  Priority,
} from '#/graphql/generated/schemaTypes';
import {
  UseNotificationsOnLaunch_NotificationFragmentDoc,
  type UseNotificationsOnLaunch_NotificationFragment,
} from '#features/notifications/hooks/useNotificationsOnLaunch.generated';
import {
  toDisplayNotification,
  type DisplayNotification,
} from '#features/notifications/utils/toDisplayNotification';
import { RecommendedRecipeDocument } from '#features/recipes/ui/useRecommendedRecipes.generated';
import { NotificationDetailScreen } from '../NotificationDetailScreen';

// Its midnight timer re-arms itself, so a mounted watch never drains.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));

const mockToRecipeDetail = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({
    goBack: jest.fn(),
    toRecipeDetail: mockToRecipeDetail,
  }),
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: ({ name }: { name: string }) => {
    const { Text } = require('react-native');
    return <Text>{name}</Text>;
  },
}));
jest.mock(
  '#features/notifications/components/NotificationActionHandler',
  () => ({
    NotificationActionHandler: ({
      children,
    }: {
      children: (props: {
        handleNotificationAction: () => void;
      }) => React.ReactNode;
    }) => children({ handleNotificationAction: jest.fn() }),
  }),
);
jest.mock('date-fns/format', () => ({
  format: () => 'Jan 1, 2026',
}));

type DetailRoute = React.ComponentProps<
  typeof NotificationDetailScreen
>['route'];

type DetailParams = DetailRoute['params'];

type ServerRow = UseNotificationsOnLaunch_NotificationFragment;

const makeRoute = (params: Partial<DetailParams> = {}): DetailRoute => ({
  params: params as DetailParams,
});

/** The row as the server sends it; the feed reads it through this fragment. */
const serverRow = (overrides: Partial<ServerRow>): ServerRow => ({
  __typename: 'Notification',
  id: 'n-1',
  type: NotificationType.ListUpdated,
  isAuthoredContent: false,
  status: NotificationStatus.Sent,
  priority: Priority.Normal,
  title: null,
  message: null,
  payload: {},
  data: null,
  category: NotificationCategory.Pantry,
  sentAt: '2026-01-01T00:00:00Z',
  expiresAt: null,
  sourceId: null,
  sourceType: null,
  pantryItemId: null,
  actionUrl: null,
  readAt: null,
  ...overrides,
});

// The server's English rides along on the fragment, as it does on the wire.
const makeNotification = (
  type: NotificationType,
  data: ServerRow['data'],
  server: { title: string; message: string },
): DisplayNotification =>
  toDisplayNotification(serverRow({ type, data, ...server }));

const milkExpiring: ServerRow['data'] = {
  __typename: 'ExpiryReminderNotificationData',
  itemName: 'Milk',
  daysUntilExpiry: 1,
  expiresOn: null,
  isMultiBatch: false,
  batchOpenedAt: null,
  batchAddedAt: null,
};

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('NotificationDetailScreen', () => {
  it('shows error when notification is missing', () => {
    renderWithApollo(<NotificationDetailScreen route={makeRoute()} />);
    expect(screen.getByText('Notification not found')).toBeTruthy();
  });

  it('renders an expiry reminder from its data', () => {
    const server = {
      title: 'Expiration Reminder',
      message: 'Milk expires in 2 days (Mar 3)',
    };
    const notification = makeNotification(
      NotificationType.ExpiryReminder,
      milkExpiring,
      server,
    );
    renderWithApollo(
      <NotificationDetailScreen route={makeRoute({ notification })} />,
    );
    expect(screen.getByText('Expiry reminder')).toBeTruthy();
    expect(screen.getByText('Milk: Expires tomorrow')).toBeTruthy();
    expect(screen.queryByText(server.title)).toBeNull();
    expect(screen.queryByText(server.message)).toBeNull();
  });

  it('renders a low-stock alert from its data', () => {
    const server = {
      title: 'Low Stock Alert',
      message: 'Rice is running low (2 remaining)',
    };
    const notification = makeNotification(
      NotificationType.LowStock,
      {
        __typename: 'LowStockNotificationData',
        itemName: 'Rice',
        currentQuantity: 2,
      },
      server,
    );
    renderWithApollo(
      <NotificationDetailScreen route={makeRoute({ notification })} />,
    );
    expect(screen.getByText('Low stock')).toBeTruthy();
    expect(screen.getByText('Rice is running low (2 left)')).toBeTruthy();
    expect(screen.queryByText(server.title)).toBeNull();
    expect(screen.queryByText(server.message)).toBeNull();
  });

  it('falls back to generic copy, not the server text, for a row with no data', () => {
    const server = {
      title: 'Announcement',
      message: 'A message an administrator typed',
    };
    const notification = makeNotification(
      NotificationType.ListUpdated,
      null,
      server,
    );
    renderWithApollo(
      <NotificationDetailScreen route={makeRoute({ notification })} />,
    );
    expect(screen.getByText('Shopping list updated')).toBeTruthy();
    expect(screen.getByText('A shared shopping list has changes')).toBeTruthy();
    expect(screen.queryByText(server.message)).toBeNull();
  });

  it("shows the details an authored row's author attached", () => {
    const notification = toDisplayNotification(
      serverRow({
        isAuthoredContent: true,
        title: 'Scheduled maintenance',
        message: 'The app is read-only on Sunday morning.',
        payload: { details: 'From 6 to 8 AM.' },
      }),
    );
    renderWithApollo(
      <NotificationDetailScreen route={makeRoute({ notification })} />,
    );
    expect(
      screen.getByText('The app is read-only on Sunday morning.'),
    ).toBeTruthy();
    expect(screen.getByText('From 6 to 8 AM.')).toBeTruthy();
  });

  describe("an expiry reminder's stack action", () => {
    const takeAction = t('notifications.takeAction');

    // Only `pantryItemId` says what stack the server names now.
    const reminder = (pantryItemId: string | null) =>
      serverRow({
        type: NotificationType.ExpiryReminder,
        data: milkExpiring,
        pantryItemId,
      });

    const openedOn = (row: ServerRow) =>
      makeRoute({ id: row.id, notification: toDisplayNotification(row) });

    it('is offered while the server names the stack', () => {
      renderWithApollo(
        <NotificationDetailScreen route={openedOn(reminder('s-1'))} />,
      );
      expect(screen.getByText(takeAction)).toBeTruthy();
    });

    it('is not offered, and no error is shown, when the server names no stack', () => {
      renderWithApollo(
        <NotificationDetailScreen route={openedOn(reminder(null))} />,
      );
      expect(screen.getByText('Milk: Expires tomorrow')).toBeTruthy();
      expect(screen.queryByText(takeAction)).toBeNull();
      expect(screen.queryByText(t('notifications.notFound'))).toBeNull();
    });

    // The route carries the row as it was when the screen opened; the cache
    // carries what the server says now.
    it('is withdrawn when the server stops naming the stack while the screen is open', async () => {
      const cache = makeCache();
      const write = (row: ServerRow) =>
        seedFragment(cache, {
          fragment: UseNotificationsOnLaunch_NotificationFragmentDoc,
          fragmentName: 'useNotificationsOnLaunch_notification',
          data: row,
        });
      write(reminder('s-1'));
      renderWithApollo(
        <NotificationDetailScreen route={openedOn(reminder('s-1'))} />,
        { cache },
      );
      expect(screen.getByText(takeAction)).toBeTruthy();

      act(() => {
        write(reminder(null));
      });

      await drainTimers();
      expect(screen.queryByText(takeAction)).toBeNull();
      expect(screen.getByText('Milk: Expires tomorrow')).toBeTruthy();
    });
  });

  describe('recipe recommendations', () => {
    const server = {
      title: 'Recipes for your pantry',
      message: 'Your pantry is ready for Chili and Tacos',
    };
    const recommendation = makeNotification(
      NotificationType.RecipeRecommendations,
      {
        __typename: 'RecipeRecommendationsNotificationData',
        recipeCount: 2,
        recipes: [
          {
            __typename: 'NotificationRecommendedRecipe',
            recipeId: 'r-1',
            name: 'Chili',
            matchPercentage: 80,
          },
          {
            __typename: 'NotificationRecommendedRecipe',
            recipeId: 'r-2',
            name: 'Tacos',
            matchPercentage: 60,
          },
        ],
      },
      server,
    );
    const recipeAnswer = (
      id: string,
      recipe: {
        name: string;
        servings: number;
        totalTimeMinutes: number;
      } | null,
    ) => {
      const data: MockDataFor<typeof RecommendedRecipeDocument> = {
        recipe: recipe && {
          __typename: 'Recipe',
          id,
          imageUrl: null,
          ...recipe,
        },
      };
      return {
        request: { query: RecommendedRecipeDocument, variables: { id } },
        result: { data },
      };
    };
    const turkeyChili = {
      name: 'Turkey Chili',
      servings: 4,
      totalTimeMinutes: 45,
    };
    const renderRecommendation = (
      operationMocks: ReadonlyArray<MockedResponse>,
    ) =>
      renderWithApollo(
        <NotificationDetailScreen
          route={makeRoute({ notification: recommendation })}
        />,
        { operationMocks },
      );

    it('lists each recipe as it is now, with the coverage it was recommended with, and opens it', async () => {
      renderRecommendation([
        recipeAnswer('r-1', turkeyChili),
        // Removed since it was recommended.
        recipeAnswer('r-2', null),
      ]);

      await drainTimers();
      expect(screen.getByText('Turkey Chili')).toBeTruthy();
      expect(screen.getByText(/45 min • 4 servings/)).toBeTruthy();
      expect(screen.getByText('80%')).toBeTruthy();
      await drainTimers();
      expect(screen.queryByText('Tacos')).toBeNull();
      expect(screen.queryByText(server.message)).toBeNull();

      await userEvent.setup().press(screen.getByText('Turkey Chili'));

      expect(mockToRecipeDetail).toHaveBeenCalledWith({ recipeId: 'r-1' });
    });

    it('keeps a recipe whose read failed, as it was recommended', async () => {
      renderRecommendation([
        {
          request: {
            query: RecommendedRecipeDocument,
            variables: { id: 'r-1' },
          },
          error: new Error('Network request failed'),
        },
        recipeAnswer('r-2', { ...turkeyChili, name: 'Fish Tacos' }),
      ]);

      // The reads land in order: once the second shows, the first has failed.
      await drainTimers();
      expect(screen.getByText('Fish Tacos')).toBeTruthy();
      expect(screen.getByText('Chili')).toBeTruthy();
      expect(screen.getByText('80%')).toBeTruthy();
    });

    // `recipe` is nullable, so a resolver that throws answers null beside its
    // error: that is a read that failed, not a recipe that is gone.
    it('keeps a recipe the API answered null for with an error', async () => {
      renderRecommendation([
        {
          request: {
            query: RecommendedRecipeDocument,
            variables: { id: 'r-1' },
          },
          result: {
            data: { recipe: null },
            errors: [new GraphQLError('Internal error', { path: ['recipe'] })],
          },
        },
        recipeAnswer('r-2', { ...turkeyChili, name: 'Fish Tacos' }),
      ]);

      await drainTimers();
      expect(screen.getByText('Fish Tacos')).toBeTruthy();
      expect(screen.getByText('Chili')).toBeTruthy();
      expect(screen.getByText('80%')).toBeTruthy();
    });

    it('shows its message when every recipe is gone', async () => {
      renderRecommendation([
        recipeAnswer('r-1', null),
        recipeAnswer('r-2', null),
      ]);

      await drainTimers();
      expect(screen.getByText(server.message)).toBeTruthy();
      expect(screen.queryByText('Chili')).toBeNull();
      expect(screen.queryByText('Tacos')).toBeNull();
    });
  });
});
