import { act } from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import { alertService } from '#/services/alertService';
import {
  recordMock,
  renderHookWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { cacheShows } from '#/test-utils/cacheWaits';
import { t } from '#/i18n';
import { todayKey } from '#/utils/dateUtils';
import {
  ErrorCode,
  ItemCondition,
  StorageState,
  StorageType,
} from '#/graphql/generated/schemaTypes';
import { PantryItem_ListedFragmentDoc } from '#features/pantry/cache/pantryItemListed.generated';
import { UpdatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import {
  UseUpdatePantryItem_PantryItemFragmentDoc,
  type UseUpdatePantryItem_PantryItemFragment,
} from '../useUpdatePantryItem.generated';
import type { DirtyFieldFlags, FormDataInput } from '../types';
import { useUpdatePantryItem } from '../useUpdatePantryItem';

const STACK = 'stack-1';
const SHOWN = {
  fragment: UseUpdatePantryItem_PantryItemFragmentDoc,
  fragmentName: 'useUpdatePantryItem_pantryItem',
} as const;

/** Milk sized in grams, as its detail holds it. */
function heldStack(version = 3) {
  const cache = makeCache();
  seedFragment(cache, {
    ...SHOWN,
    id: `PantryItem:${STACK}`,
    data: {
      __typename: 'PantryItem',
      id: STACK,
      version,
      itemName: 'Milk',
      storageState: StorageState.Ambient,
      condition: ItemCondition.Good,
      expiresOn: '2026-11-20',
      tags: ['dairy'],
      minQuantity: 1,
      restockQuantity: 4,
      storageNotes: 'Top shelf',
      netWeight: 1360.78,
      netWeightUnit: { __typename: 'Unit', id: 'unit-g' },
      storageLocation: {
        __typename: 'StorageLocation',
        id: 'loc-fridge',
        name: 'Fridge',
      },
      brand: { __typename: 'Brand', id: 'brand-old', name: 'Acme' },
    },
  });
  return cache;
}

/** The form as it opens on that stack. */
const FORM: FormDataInput = {
  itemName: 'Milk',
  storageState: StorageState.Ambient,
  location: 'Fridge',
  notes: 'Top shelf',
  unit: 'g',
};

const shown = (cache: ReturnType<typeof makeCache>) =>
  cache.readFragment({
    ...SHOWN,
    id: `PantryItem:${STACK}`,
    optimistic: true,
  });

/** Resolves once the stack, as the cache shows it, is named `name` again. */
const namedAgain = (cache: ReturnType<typeof makeCache>, name: string) =>
  cacheShows(
    cache,
    { ...SHOWN, from: `PantryItem:${STACK}` },
    () => shown(cache)?.itemName,
    seen => seen === name,
  );

let log = operationLog();

interface Edit {
  input?: Partial<FormDataInput>;
  dirty: DirtyFieldFlags;
  locationId?: string | null;
  brandId?: string | null;
  storageLocation?: { id: string; name: string; type: StorageType };
}

function renderUpdate(
  cache: ReturnType<typeof makeCache>,
  answers: ReturnType<typeof recordMock>[] = [],
  refetch?: () => void,
) {
  const { result } = renderHookWithApollo(
    () => useUpdatePantryItem({ refetch }),
    {
      cache,
      links: [log.link],
      operationMocks: answers.map(answer => answer.mock),
    },
  );
  const save = ({
    input = {},
    dirty,
    locationId = null,
    brandId = null,
    storageLocation,
  }: Edit) =>
    result.current.updatePantryItemFields({
      itemId: STACK,
      input: { ...FORM, ...input },
      dirtyFields: dirty,
      selectedLocationId: locationId,
      selectedBrandId: brandId,
      selectedStorageLocation: storageLocation,
    });
  /** Saves and waits for the outcome, as the form does. */
  const saved = async (edit: Edit) => {
    let stands: boolean | undefined;
    await act(async () => {
      stands = await save(edit);
    });
    return stands;
  };
  return { save, saved };
}

const queued = () =>
  recordMock(UpdatePantryItemDocument, { data: { updatePantryItem: null } });
const held = () =>
  recordMock(UpdatePantryItemDocument, {
    data: { updatePantryItem: null },
    held: true,
  });
const refused = (field: string | null, code = ErrorCode.ValidationFailed) =>
  recordMock(UpdatePantryItemDocument, {
    data: {
      updatePantryItem: {
        __typename: 'ValidationError',
        code,
        message: 'The server’s own words',
        field,
      },
    },
  });

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
});

describe('what shows before the server answers', () => {
  it.each<{
    what: string;
    edit: Edit;
    shows: Partial<UseUpdatePantryItem_PantryItemFragment>;
  }>([
    {
      what: 'a new name',
      edit: { input: { itemName: 'Oat milk' }, dirty: { itemName: true } },
      shows: { itemName: 'Oat milk' },
    },
    {
      what: 'a storage state',
      edit: {
        input: { storageState: StorageState.Frozen },
        dirty: { storageState: true },
      },
      shows: { storageState: StorageState.Frozen },
    },
    {
      what: 'a condition',
      edit: {
        input: { condition: ItemCondition.Fair },
        dirty: { condition: true },
      },
      shows: { condition: ItemCondition.Fair },
    },
    {
      what: 'an expiry, as a day',
      edit: {
        input: { expirationDate: new Date(2026, 11, 24, 18, 30) },
        dirty: { expirationDate: true },
      },
      shows: { expiresOn: '2026-12-24' },
    },
    {
      what: 'a cleared expiry',
      edit: { dirty: { expirationDate: true } },
      shows: { expiresOn: null },
    },
    {
      what: 'tags',
      edit: { input: { tags: ['dairy', 'oat'] }, dirty: { tags: true } },
      shows: { tags: ['dairy', 'oat'] },
    },
    {
      what: 'a low-stock threshold',
      edit: { input: { minQuantity: '2.5' }, dirty: { minQuantity: true } },
      shows: { minQuantity: 2.5 },
    },
    {
      what: 'a restock amount',
      edit: {
        input: { restockQuantity: '6' },
        dirty: { restockQuantity: true },
      },
      shows: { restockQuantity: 6 },
    },
    {
      what: 'notes',
      edit: { input: { notes: 'Door' }, dirty: { notes: true } },
      shows: { storageNotes: 'Door' },
    },
    {
      what: 'a typed location',
      edit: { input: { location: ' Garage ' }, dirty: { location: true } },
      shows: {
        storageLocation: {
          __typename: 'StorageLocation',
          id: expect.any(String),
          version: expect.any(Number),
          name: 'Garage',
          type: StorageType.Custom,
        },
      },
    },
    {
      what: 'no location for one of spaces',
      edit: { input: { location: '  ' }, dirty: { location: true } },
      shows: { storageLocation: null },
    },
    {
      what: 'a picked location, under its own id',
      edit: {
        input: { location: 'Chest freezer' },
        dirty: { location: true },
        locationId: 'loc-2',
        storageLocation: {
          id: 'loc-2',
          name: 'Chest freezer',
          type: StorageType.Freezer,
        },
      },
      shows: {
        storageLocation: {
          __typename: 'StorageLocation',
          id: 'loc-2',
          version: expect.any(Number),
          name: 'Chest freezer',
          type: StorageType.Freezer,
        },
      },
    },
    {
      what: 'a typed brand',
      edit: { input: { brand: ' Sunrise ' }, dirty: { brand: true } },
      shows: {
        brand: {
          __typename: 'Brand',
          id: expect.any(String),
          version: expect.any(Number),
          name: 'Sunrise',
        },
      },
    },
    {
      what: 'a picked brand, under its own id',
      edit: {
        input: { brand: 'Sunrise' },
        dirty: { brand: true },
        brandId: 'brand-1',
      },
      shows: {
        brand: {
          __typename: 'Brand',
          id: 'brand-1',
          version: expect.any(Number),
          name: 'Sunrise',
        },
      },
    },
    {
      what: 'no brand for one of spaces',
      edit: { input: { brand: '  ' }, dirty: { brand: true } },
      shows: { brand: null },
    },
    {
      what: 'a size typed in the stack’s own unit',
      edit: {
        input: { netWeight: '1000', netWeightUnitId: 'unit-g' },
        dirty: { netWeight: true },
      },
      shows: { netWeight: 1000 },
    },
    // 2.5 against the stack's grams would read "2.5 g" until the server
    // re-expresses every batch in pounds.
    {
      what: 'nothing new for a size typed in another unit',
      edit: {
        input: { netWeight: '2.5', netWeightUnitId: 'unit-lb' },
        dirty: { netWeight: true },
      },
      shows: { netWeight: 1360.78 },
    },
  ])('shows $what', async ({ edit, shows }) => {
    const cache = heldStack();
    const { save } = renderUpdate(cache, [held()]);

    await act(async () => {
      void save(edit);
    });

    expect(shown(cache)).toMatchObject(shows);
  });
});

describe('what is sent', () => {
  // A stack a list holds can be edited with nothing read first.
  it('only the change, at the version the device holds', async () => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: PantryItem_ListedFragmentDoc,
      fragmentName: 'pantryItem_listed',
      data: { __typename: 'PantryItem', id: STACK, version: 7 },
    });
    const update = queued();
    const { saved } = renderUpdate(cache, [update]);

    await saved({ input: { itemName: 'Oat milk' }, dirty: { itemName: true } });

    expect(update.fired[0]).toMatchObject({ today: todayKey() });
    expect(update.fired[0]?.input).toEqual({
      id: STACK,
      version: 7,
      itemName: 'Oat milk',
      idempotencyKey: expect.any(String),
    });
  });

  it('a picked location and brand by their ids', async () => {
    const update = queued();
    const { saved } = renderUpdate(heldStack(), [update]);

    await saved({
      input: { location: 'Chest freezer', brand: 'Sunrise' },
      dirty: { location: true, brand: true },
      locationId: 'loc-2',
      brandId: 'brand-1',
    });

    expect(update.fired[0]).toMatchObject({
      input: {
        storage: { location: { id: 'loc-2' } },
        brand: { id: 'brand-1' },
      },
    });
  });

  it('nothing for an edit that changes nothing, which stands', async () => {
    const update = queued();
    const { saved } = renderUpdate(heldStack(), [update]);

    expect(await saved({ dirty: {} })).toBe(true);
    expect(update.fired).toEqual([]);
  });

  it('stands once it is queued', async () => {
    const { saved } = renderUpdate(heldStack(), [queued()]);

    expect(
      await saved({
        input: { itemName: 'Oat milk' },
        dirty: { itemName: true },
      }),
    ).toBe(true);
  });
});

describe('a refusal', () => {
  /** Saves a rename the server refuses, and lets the stack snap back. */
  async function refusedRename(answer: ReturnType<typeof recordMock>) {
    const cache = heldStack();
    const { save } = renderUpdate(cache, [answer]);
    let stands: boolean | undefined;
    await act(async () => {
      const back = namedAgain(cache, 'Milk');
      stands = await save({
        input: { itemName: 'Oat milk' },
        dirty: { itemName: true },
      });
      await back;
    });
    return stands;
  }

  // The server's `message` is English only, so the field it names picks the
  // app's own sentence.
  it.each([
    ['the name', 'itemName', t('errors.field.itemName')],
    ['the unit', 'unit', t('errors.field.unit')],
    ['a field it has no words for', 'shelfLife', t('errors.updateItemFailed')],
  ])(
    'puts the stack back and says why, in the app’s words, naming %s',
    async (_naming, field, says) => {
      expect(await refusedRename(refused(field))).toBe(false);

      expect(alertService.alert).toHaveBeenCalledWith(t('labels.error'), says);
    },
  );

  it('offers to refresh a stack changed elsewhere', async () => {
    const refetch = jest.fn();
    const alert = jest.spyOn(alertService, 'alert');
    const { saved } = renderUpdate(
      heldStack(),
      [refused(null, ErrorCode.VersionConflict)],
      refetch,
    );

    await saved({ input: { itemName: 'Oat milk' }, dirty: { itemName: true } });

    const [, , buttons] = alert.mock.calls[0] ?? [];
    buttons?.find(button => button.text === t('labels.refresh'))?.onPress?.();
    expect(refetch).toHaveBeenCalledTimes(1);
  });
});

it('says so when the device holds no such stack, rather than saving nothing', async () => {
  const update = queued();
  const { saved } = renderUpdate(makeCache(), [update]);

  expect(
    await saved({ input: { itemName: 'Oat milk' }, dirty: { itemName: true } }),
  ).toBe(false);
  expect(alertService.alert).toHaveBeenCalledWith(
    t('labels.error'),
    t('itemForm.updateFailed'),
  );
  expect(update.fired).toEqual([]);
});
