'use no memo';

import { todayKey } from '#/utils/dateUtils';
import React from 'react';
import { gql, type InMemoryCache } from '@apollo/client';
import type { DocumentNode } from 'graphql';
import { act, fireEvent, screen } from '@testing-library/react-native';
import {
  type MockDataFor,
  recordMock,
  renderWithApollo,
  seedFragment,
  seedQuery,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { makeCache } from '#/apollo/cache';
import { isRecord } from '#/utils/isRecord';
import { useStore } from '#store';
import {
  CreatePantryDocument,
  DeletePantryDocument,
  GetPantryDocument,
  MarkPantryAsDefaultDocument,
  UpdatePantryDocument,
} from '#features/pantry/graphql/pantry.generated';
import { usePantryPermissions } from '#features/pantry/hooks/usePantryPermissions';
import { ErrorCode } from '#/graphql/generated/schemaTypes';
import {
  pantryData,
  type PantryFixture,
} from '../../../../../__tests__/helpers/fixtures/pantryFixtures';
import { alertService } from '#/services/alertService';
import { errorService } from '#/services/errorService';
import { subscriptionService } from '#/services/subscriptions/SubscriptionService';
import { Text as AppText } from '#components/atoms/Text';
import {
  HomePantries_HomeFragmentDoc,
  type HomePantries_HomeFragment,
} from '#features/home/utils/homePantries.generated';
import type { Unmasked } from '@apollo/client/masking';
import { PantrySettings } from '../PantrySettings';

type HomeEdge =
  Unmasked<HomePantries_HomeFragment>['pantriesConnection']['edges'][number];

// The day stays fixed: the hook's midnight timer re-arms itself.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));
jest.mock('#hooks/navigation/useAppNavigation');
jest.mock('#/services/errorService');
jest.mock('#/services/subscriptions/SubscriptionService', () => ({
  subscriptionService: {
    registerParentDeletion: jest.fn(),
    unregisterParentDeletion: jest.fn(),
  },
}));
jest.mock('#features/pantry/hooks/usePantryPermissions');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

const PANTRY = gql`
  fragment PantrySettingsTestPantry on Pantry {
    name
    description
    isDefault
  }
`;

const ALL_PERMISSIONS = {
  canAddItems: true,
  canEditItems: true,
  canRemoveItems: true,
  canCreatePantry: true,
  canDeletePantry: true,
};

const kitchen: PantryFixture = {
  id: 'p1',
  name: 'Kitchen Pantry',
  description: 'Main pantry',
  isDefault: false,
  items: [{ id: 'i1' }, { id: 'i2' }],
};

const editing = { params: { pantryId: 'p1' } };
const creating = { params: undefined };

let log = operationLog();

/** Waits for the operation's nth answer, then lets what it started render. */
const answered = (document: DocumentNode, nth = 1) =>
  act(async () => {
    await log.answered(document, nth);
  });

/** The home's pantries, as the app reads them. */
function seedHome(cache: InMemoryCache, pantryIds: string[]) {
  seedFragment(cache, {
    fragment: HomePantries_HomeFragmentDoc,
    data: {
      __typename: 'Home',
      id: 'h1',
      pantriesConnection: {
        __typename: 'PantryConnection',
        edges: pantryIds.map(
          (id): HomeEdge => ({
            __typename: 'PantryEdge',
            node: { __typename: 'Pantry', id, isDefault: false },
          }),
        ),
      },
    },
  });
}

const homePantries = (cache: InMemoryCache) =>
  cache
    .readFragment({
      id: 'Home:h1',
      fragment: HomePantries_HomeFragmentDoc,
      optimistic: true,
    })
    ?.pantriesConnection.edges.map(({ node }) => node.id);

const pantryRow = (cache: InMemoryCache, id: string) =>
  cache.readFragment<{
    name: string;
    description: string | null;
    isDefault: boolean;
  }>({ id: `Pantry:${id}`, fragment: PANTRY, optimistic: true });

/** The edit screen over a seeded pantry, its read answered as the cache holds it. */
async function renderEditing(
  pantry: PantryFixture = kitchen,
  answers: ReturnType<typeof recordMock>[] = [],
) {
  const cache = makeCache();
  seedQuery(cache, {
    query: GetPantryDocument,
    variables: {
      id: pantry.id,
      itemsFirst: 25,
      storageLocationsFirst: 15,
      today: todayKey(),
    },
    data: pantryData(pantry),
  });
  seedHome(cache, [pantry.id]);
  renderWithApollo(<PantrySettings route={editing} />, {
    cache,
    links: [log.link],
    operationMocks: [
      recordMock(GetPantryDocument, { data: pantryData(pantry) }).mock,
      ...answers.map(answer => answer.mock),
    ],
  });
  await answered(GetPantryDocument);
  return cache;
}

/** The create screen, over a home that has no pantry yet. */
function renderCreating(answers: ReturnType<typeof recordMock>[] = []) {
  const cache = makeCache();
  seedHome(cache, []);
  renderWithApollo(<PantrySettings route={creating} />, {
    cache,
    links: [log.link],
    operationMocks: answers.map(answer => answer.mock),
  });
  return cache;
}

/** Resolves with the next pantry the store selects. */
const nextSelectedPantry = () =>
  new Promise<string | null>(resolve => {
    const unsubscribe = useStore.subscribe(
      state => state.selectedPantryId,
      id => {
        unsubscribe();
        resolve(id);
      },
    );
  });

/** The destructive button of the last alert. */
const destructiveButton = () =>
  jest
    .mocked(alertService.alert)
    .mock.calls.at(-1)?.[2]
    ?.find(button => button.style === 'destructive');

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(usePantryPermissions).mockReturnValue(ALL_PERMISSIONS);
  useStore.setState({ selectedHomeId: 'h1', selectedPantryId: 'p1' });
  log = operationLog();
});

describe('editing a pantry', () => {
  it('shows its settings, item count and danger zone', async () => {
    await renderEditing();

    expect(screen.getByText('Pantry Settings')).toBeTruthy();
    expect(screen.getByDisplayValue('Kitchen Pantry')).toBeTruthy();
    expect(screen.getByDisplayValue('Main pantry')).toBeTruthy();
    expect(screen.getByText('Items in pantry:')).toBeTruthy();
    expect(screen.getByText('2 items')).toBeTruthy();
    expect(screen.getByText('Danger Zone')).toBeTruthy();
    expect(screen.getByText('Save')).toBeTruthy();
  });

  it('hides the danger zone from someone who cannot delete it', async () => {
    jest
      .mocked(usePantryPermissions)
      .mockReturnValue({ ...ALL_PERMISSIONS, canDeletePantry: false });

    await renderEditing();

    expect(screen.queryByText('Danger Zone')).toBeNull();
  });

  // The accent says there is something to save; with nothing, Save still saves.
  it('reads Save in plain text until the name or description changes', async () => {
    await renderEditing();
    const saveTone = () =>
      screen
        .UNSAFE_getAllByType(AppText)
        .find(node => node.props.children === 'Save')?.props.tone;
    expect(saveTone()).toBe('primary');

    fireEvent.changeText(
      screen.getByDisplayValue('Kitchen Pantry'),
      'Kitchen Pantry 2',
    );

    expect(saveTone()).toBe('accent');
  });

  it('shows the name trimmed while it saves', async () => {
    const update = recordMock(UpdatePantryDocument, { held: true });
    const cache = await renderEditing(kitchen, [update]);

    fireEvent.changeText(
      screen.getByDisplayValue('Kitchen Pantry'),
      '  Garage  ',
    );
    fireEvent.press(screen.getByText('Save'));
    await log.requested(UpdatePantryDocument);

    expect(pantryRow(cache, 'p1')).toMatchObject({
      name: 'Garage',
      description: 'Main pantry',
    });
  });

  it('refuses an empty name', async () => {
    await renderEditing({ ...kitchen, name: '' });

    fireEvent.press(screen.getByText('Save'));

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'Pantry name cannot be empty',
    );
  });

  it('puts the Default switch back when the server refuses it', async () => {
    const markDefault = recordMock(MarkPantryAsDefaultDocument, {
      held: true,
      data: {
        markPantryAsDefault: {
          __typename: 'ForbiddenError',
          code: ErrorCode.Forbidden,
          message: 'Not yours',
        },
      },
    });
    await renderEditing(kitchen, [markDefault]);
    const isOn = () => screen.getByLabelText('Default Pantry').props.value;

    fireEvent(screen.getByLabelText('Default Pantry'), 'valueChange', true);
    await log.requested(MarkPantryAsDefaultDocument);
    expect(isOn()).toBe(true);

    markDefault.release();
    await answered(MarkPantryAsDefaultDocument);
    expect(isOn()).toBe(false);
  });

  it('reports a pantry that fails to load', async () => {
    renderWithApollo(<PantrySettings route={editing} />, {
      cache: makeCache(),
      links: [log.link],
      operationMocks: [
        recordMock(GetPantryDocument, { error: new Error('offline') }).mock,
      ],
    });
    await answered(GetPantryDocument);

    expect(errorService.reportError).toHaveBeenCalled();
    expect(alertService.alert).toHaveBeenCalled();
  });

  describe('deleting it', () => {
    it('asks first, naming the pantry', async () => {
      await renderEditing();

      fireEvent.press(screen.getByText('Delete Pantry'));

      expect(alertService.alert).toHaveBeenCalledWith(
        'Delete Kitchen Pantry?',
        expect.stringContaining('Are you sure'),
        expect.any(Array),
      );
    });

    it('takes it off the home at once, then clears the selection and goes back', async () => {
      const remove = recordMock(DeletePantryDocument, {
        held: true,
        data: {
          deletePantry: {
            __typename: 'DeletePantryPayload',
            pantry: { __typename: 'Pantry', id: 'p1' },
          },
        },
      });
      const cache = await renderEditing(kitchen, [remove]);

      fireEvent.press(screen.getByText('Delete Pantry'));
      act(() => {
        destructiveButton()?.onPress?.();
      });
      await log.requested(DeletePantryDocument);

      expect(subscriptionService.registerParentDeletion).toHaveBeenCalledWith(
        'p1',
      );
      expect(homePantries(cache)).toEqual([]);

      remove.release();
      await answered(DeletePantryDocument);

      expect(useStore.getState().selectedPantryId).toBeNull();
      expect(mockNav.goBack).toHaveBeenCalled();
    });
  });
});

describe('creating a pantry', () => {
  it('shows a create form without information or danger zone', () => {
    renderCreating();

    expect(screen.getByText('Create New Pantry')).toBeTruthy();
    expect(screen.getByText('Create')).toBeTruthy();
    expect(screen.queryByText('Information')).toBeNull();
    expect(screen.queryByText('Danger Zone')).toBeNull();
  });

  it('adds it to the home as typed, selects it and goes back', async () => {
    const create = recordMock(CreatePantryDocument, {
      held: true,
      dataFor: (vars): MockDataFor<typeof CreatePantryDocument> => ({
        createPantry: {
          __typename: 'CreatePantryPayload',
          pantry: {
            __typename: 'Pantry',
            id: isRecord(vars.input) ? String(vars.input.id) : '',
          },
        },
      }),
    });
    const cache = renderCreating([create]);

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter pantry name (e.g., Kitchen Pantry)'),
      '  Garage  ',
    );
    fireEvent(screen.getByLabelText('Default Pantry'), 'valueChange', true);
    fireEvent.press(screen.getByText('Create'));
    await log.requested(CreatePantryDocument);

    const [created] = homePantries(cache) ?? [];
    expect(created).toBeDefined();
    expect(pantryRow(cache, created ?? '')).toMatchObject({
      name: 'Garage',
      description: 'User created pantry',
      isDefault: true,
    });

    const selected = nextSelectedPantry();
    create.release();
    await act(async () => {
      await selected;
    });

    expect(await selected).toBe(created);
    expect(mockNav.goBack).toHaveBeenCalled();
  });

  it('refuses with no home selected', () => {
    useStore.setState({ selectedHomeId: null });
    renderCreating();

    fireEvent.changeText(
      screen.getByPlaceholderText('Enter pantry name (e.g., Kitchen Pantry)'),
      'Garage',
    );
    fireEvent.press(screen.getByText('Create'));

    expect(alertService.alert).toHaveBeenCalledWith(
      'Error',
      'No home selected',
    );
  });
});
