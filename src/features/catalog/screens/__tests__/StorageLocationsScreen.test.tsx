import React from 'react';
import { act, screen, userEvent, within } from '@testing-library/react-native';
import {
  inputOf,
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { useStore } from '#store';
import { resetSessionScopedStores } from '#store/sessionScopedStores';
import { t, type TranslationKey } from '#/i18n';
import { alertService } from '#/services/alertService';
import {
  ErrorCode,
  ErrorDisposition,
  StorageType,
} from '#/graphql/generated/schemaTypes';
import {
  CreateStorageLocationDocument,
  DeleteStorageLocationDocument,
  GetStorageLocationsDocument,
  MarkStorageLocationAsDefaultDocument,
  UpdateStorageLocationDocument,
} from '#features/catalog/graphql/storageLocation.generated';
import { StorageLocationCard } from '#features/catalog/ui/StorageLocationCard';
import { StorageLocationSheet } from '#features/catalog/ui/StorageLocationSheet/StorageLocationSheet';
import type { StorageLocationFormValues } from '#features/catalog/ui/StorageLocationForm';
import { DetailTemplate } from '#components/templates/DetailTemplate';
import { StorageLocationsScreen } from '../StorageLocationsScreen';

jest.mock('#hooks/navigation/useAppNavigation');

let log = operationLog();

const HOME_ID = 'home-1';

type Connection = NonNullable<
  MockDataFor<typeof GetStorageLocationsDocument>['storageLocations']
>;
type LocationNode = NonNullable<
  NonNullable<NonNullable<Connection['edges']>[number]>['node']
>;

const location = (
  id: string,
  name: string,
  over: Partial<LocationNode> = {},
): LocationNode => ({
  __typename: 'StorageLocation',
  id,
  name,
  type: StorageType.Cabinet,
  isDefault: false,
  currentItemCount: 0,
  sortOrder: 0,
  parentLocation: null,
  ...over,
});

const PANTRY = location('loc-pantry', 'Pantry', { isDefault: true });
const KITCHEN = location('loc-kitchen', 'Kitchen', { sortOrder: 1 });
const FRIDGE = location('loc-fridge', 'Fridge', {
  sortOrder: 2,
  // Named: the parent is the kitchen's own row, which completion would rename.
  parentLocation: {
    __typename: 'StorageLocation',
    id: KITCHEN.id ?? '',
    name: KITCHEN.name ?? '',
  },
});

const locationsRead = (
  nodes: LocationNode[],
): MockDataFor<typeof GetStorageLocationsDocument> => ({
  storageLocations: {
    __typename: 'StorageLocationConnection',
    edges: nodes.map(node => ({
      __typename: 'StorageLocationEdge',
      cursor: node.id ?? '',
      node,
    })),
    pageInfo: { __typename: 'PageInfo', hasNextPage: false, endCursor: null },
    totalCount: nodes.length,
  },
});

async function openLocations({
  held = [PANTRY, KITCHEN, FRIDGE],
  readHeld = false,
  readFails = false,
  answers = [],
}: {
  held?: LocationNode[];
  readHeld?: boolean;
  readFails?: boolean;
  answers?: ReturnType<typeof recordMock>[];
} = {}) {
  renderWithApollo(
    <StorageLocationsScreen route={{ params: { homeId: HOME_ID } }} />,
    {
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        ...(readFails
          ? [
              recordMock(GetStorageLocationsDocument, {
                error: new Error('Network request failed'),
                maxUsageCount: 1,
              }).mock,
            ]
          : []),
        recordMock(GetStorageLocationsDocument, {
          held: readHeld,
          data: locationsRead(held),
        }).mock,
      ],
    },
  );
  if (!readHeld) await log.landed(GetStorageLocationsDocument);
}

const cardOf = (name: string) => {
  const card = screen
    .UNSAFE_getAllByType(StorageLocationCard)
    .find(each => each.props.location.name === name);
  if (!card) throw new Error(`no card for ${name}`);
  return card;
};

const cardNames = () =>
  screen
    .UNSAFE_getAllByType(StorageLocationCard)
    .map(card => card.props.location.name);

const sheet = () => screen.UNSAFE_getByType(StorageLocationSheet);

const VALUES: StorageLocationFormValues = {
  name: 'Garage shelf',
  type: StorageType.Cabinet,
  icon: null,
  parentLocationId: null,
  description: null,
  temperature: null,
  color: null,
  isClimateControlled: null,
  capacity: null,
  capacityUnit: null,
};

/** Presses a button of the last alert raised. */
async function answerAlert(text: string) {
  const [, , buttons] = jest.mocked(alertService.alert).mock.lastCall ?? [];
  const onPress = buttons?.find(button => button.text === text)?.onPress;
  if (!onPress) throw new Error(`no "${text}" in the last alert`);
  await act(async () => {
    onPress();
  });
}

const pressIn = async (name: string, label: string) => {
  await userEvent.setup().press(within(cardOf(name)).getByText(label));
};

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  resetSessionScopedStores();
  useStore.setState({
    user: {
      id: 'user-1',
      email: 'cook@example.com',
      emailVerified: true,
      onBoarded: true,
    },
    selectedHomeId: HOME_ID,
    selectedPantryId: 'pantry-1',
    isOnline: true,
    apiReachable: true,
  });
});

describe('the storage locations', () => {
  it('say they are loading while nothing is held', async () => {
    await openLocations({ readHeld: true });

    expect(screen.getByLabelText(t('storageLocations.loading'))).toBeTruthy();
  });

  it('say why they could not be read, and are read again', async () => {
    await openLocations({ readFails: true });

    expect(screen.getByText(t('errors.boundary.title'))).toBeTruthy();
    await userEvent.setup().press(screen.getByText(t('labels.retry')));
    await log.landed(GetStorageLocationsDocument, 2);

    expect(cardNames()).toContain('Kitchen');
  });

  it('say they are offline rather than that there are none', async () => {
    useStore.setState({ isOnline: false, apiReachable: false });
    await openLocations({ readFails: true });

    expect(screen.getByText(t('storageLocations.offlineTitle'))).toBeTruthy();
    expect(
      screen.queryByText(t('storageLocations.noLocations')),
    ).not.toBeOnTheScreen();
  });

  it('are read again on a pull', async () => {
    await openLocations();

    act(() => {
      screen.UNSAFE_getByType(DetailTemplate).props.onRefresh();
    });

    await log.requested(GetStorageLocationsDocument, 2);
  });

  it('nest sub-locations in the tree view', async () => {
    await openLocations({ held: [FRIDGE, KITCHEN] });
    expect(cardNames()).toEqual(['Fridge', 'Kitchen']);

    await userEvent
      .setup()
      .press(screen.getByText(t('storageLocations.treeView')));

    expect(cardNames()).toEqual(['Kitchen', 'Fridge']);
  });
});

describe('a new location', () => {
  it('is offered when there are none', async () => {
    await openLocations({ held: [] });

    await userEvent.setup().press(screen.getByText(t('labels.addLocation')));

    expect(sheet().props.visible).toBe(true);
    expect(sheet().props.initialData).toBeNull();
  });

  it('is offered from the header', async () => {
    await openLocations();

    await userEvent
      .setup()
      .press(screen.getByLabelText(t('labels.addLocation')));

    expect(sheet().props.visible).toBe(true);
  });

  it('is sent as the sheet fills it', async () => {
    const create = recordMock(CreateStorageLocationDocument, { held: true });
    await openLocations({ answers: [create] });

    act(() => {
      void sheet().props.onSubmit(VALUES);
    });
    await log.requested(CreateStorageLocationDocument);

    expect(inputOf(create.fired[0] ?? {})).toMatchObject({
      name: 'Garage shelf',
      homeId: HOME_ID,
    });
  });

  it('keeps the sheet open when refused', async () => {
    await openLocations({
      answers: [
        recordMock(CreateStorageLocationDocument, {
          data: {
            createStorageLocation: {
              __typename: 'ValidationError',
              code: ErrorCode.ValidationFailed,
              disposition: ErrorDisposition.Fail,
              message: 'No',
              field: 'input.name',
            },
          },
        }),
      ],
    });

    let closes: unknown;
    await act(async () => {
      closes = await sheet().props.onSubmit(VALUES);
    });

    expect(closes).toBe(false);
  });
});

describe('a location', () => {
  it('is edited in place, keeping its parent', async () => {
    const update = recordMock(UpdateStorageLocationDocument, { held: true });
    await openLocations({ answers: [update] });

    await pressIn('Fridge', t('labels.edit'));
    expect(sheet().props.initialData).toMatchObject({
      id: FRIDGE.id,
      parentLocationId: KITCHEN.id,
    });
    act(() => {
      void sheet().props.onSubmit({ ...VALUES, name: 'Big fridge' });
    });
    await log.requested(UpdateStorageLocationDocument);

    expect(inputOf(update.fired[0] ?? {})).toMatchObject({
      id: FRIDGE.id,
      name: 'Big fridge',
    });
  });

  it('is made the default', async () => {
    const mark = recordMock(MarkStorageLocationAsDefaultDocument, {
      held: true,
    });
    await openLocations({ answers: [mark] });

    await pressIn('Kitchen', t('labels.setDefault'));
    await log.requested(MarkStorageLocationAsDefaultDocument);

    expect(inputOf(mark.fired[0] ?? {})).toEqual({ id: KITCHEN.id });
  });

  it('is deleted once confirmed when it is empty', async () => {
    const remove = recordMock(DeleteStorageLocationDocument, { held: true });
    await openLocations({ answers: [remove] });

    await pressIn('Fridge', t('labels.delete'));
    await answerAlert(t('labels.delete'));
    await log.requested(DeleteStorageLocationDocument);

    expect(inputOf(remove.fired[0] ?? {})).toEqual({ id: FRIDGE.id });
  });

  const undeletable: Array<[string, string, LocationNode[], TranslationKey]> = [
    [
      'the default',
      'Pantry',
      [PANTRY],
      'storageLocations.cantDeleteDefaultTitle',
    ],
    [
      'one holding items',
      'Kitchen',
      [location('loc-kitchen', 'Kitchen', { currentItemCount: 3 })],
      'storageLocations.cantDeleteTitle',
    ],
    [
      'one with sub-locations',
      'Kitchen',
      [KITCHEN, FRIDGE],
      'storageLocations.cantDeleteTitle',
    ],
  ];

  it.each(undeletable)(
    'is not deleted when it is %s',
    async (_, name, held, title) => {
      const remove = recordMock(DeleteStorageLocationDocument, { held: true });
      await openLocations({ held, answers: [remove] });

      await pressIn(name, t('labels.delete'));

      expect(alertService.alert).toHaveBeenCalledWith(
        t(title),
        expect.any(String),
        expect.any(Array),
      );
      expect(remove.fired).toEqual([]);
    },
  );
});
