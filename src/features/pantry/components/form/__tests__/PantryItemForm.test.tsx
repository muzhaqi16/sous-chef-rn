'use no memo';

import React from 'react';
import { gql, type InMemoryCache } from '@apollo/client';

import {
  act,
  fireEvent,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { makeCache } from '#/apollo/cache';
import {
  type MockDataFor,
  recordMock,
  renderWithApollo,
  seedFragment,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { writeUnitSystemSettings } from '#/test-utils/fixtures/userSettingsFixtures';
import {
  asAbbreviation,
  readingAsAbbreviation,
} from '#/test-utils/fixtures/unitLabels';
import { useStore } from '#store';
import { t } from '#/i18n';
import { fromDateKey } from '#/utils/dateUtils';
import { formatMonthDayYear } from '#/utils/formatters/date';
import { localizeNumericHint } from '#/utils/formatters/number';
import {
  ItemCondition,
  StorageState,
  StorageType,
  UnitSystem,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { FieldRendererProvider } from '#components/molecules/fieldRenderers';
import { kitTestIDs } from '#components/testIDs';
import { catalogFieldRenderers } from '#features/catalog/ui/catalogFieldRenderers';
import { catalogTestIDs } from '#features/catalog/testIDs';
import {
  PAGES,
  PAGE_LABEL_KEYS,
  type PageName,
} from '#features/catalog/ui/AddItemForm/fields';
import { GetHomeDocument } from '#features/home/screens/useHomeDetailManagement.generated';
import {
  GetPantryDocument,
  UpdatePantryItemDocument,
  UpdatePantryItemQuantityDocument,
} from '#features/pantry/graphql/pantry.generated';
import { PantryItem_ListedFragmentDoc } from '#features/pantry/cache/pantryItemListed.generated';
import { PreviewPantryItemUnitChangeDocument } from '#features/pantry/hooks/usePantryUnitChange.generated';
import { conditionLabelKey } from '#features/pantry/utils/itemEnumLabels';
import { pantryTestIDs } from '#features/pantry/testIDs';
import {
  GetUnitBySymbolDocument,
  SearchUnitsDocument,
} from '#operations/item/unit.generated';
import { PantryItemForm_PantryItemFragmentDoc } from '../PantryItemForm.generated';
import { PantryItemForEditDocument } from '../usePantryItemFormData.generated';
import { PantryItemForm } from '../PantryItemForm';

// The day stays fixed: the hook's midnight timer re-arms itself.
jest.mock('#hooks/app/useToday', () => ({
  useToday: () => jest.requireActual('#/utils/dateUtils').todayKey(),
}));
jest.mock('#hooks/navigation/useAppNavigation');

const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

type Stack = NonNullable<
  NonNullable<MockDataFor<typeof PantryItemForEditDocument>['pantryItem']>
>;

const KILOGRAM = asAbbreviation({
  __typename: 'Unit',
  id: 'unit-kg',
  name: 'kilogram',
  symbol: 'kg',
  type: UnitType.Weight,
});

/** Units the device holds, as a fresh preload left them. */
const HELD_UNITS = [
  { ...KILOGRAM, localizedNameForms: { one: 'kilogram', other: 'kilograms' } },
  {
    ...asAbbreviation({
      id: 'unit-lb',
      name: 'pound',
      symbol: 'lb',
      type: UnitType.Weight,
    }),
    localizedNameForms: { one: 'pound', other: 'pounds' },
  },
];

type SearchedUnit = NonNullable<
  MockDataFor<typeof SearchUnitsDocument>['searchUnits']
>[number];

/** What the unit search finds: the held pound, and a stick the device lacks. */
const SEARCHED: SearchedUnit[] = [
  {
    ...asAbbreviation({
      __typename: 'Unit',
      id: 'unit-lb',
      name: 'pound',
      symbol: 'lb',
      type: UnitType.Weight,
    }),
    localizedNameForms: {
      __typename: 'PluralForms',
      one: 'pound',
      other: 'pounds',
    },
  },
  {
    ...asAbbreviation({
      __typename: 'Unit',
      id: 'unit-stick',
      name: 'stick',
      symbol: 'stick',
      type: UnitType.Count,
    }),
    localizedNameForms: {
      __typename: 'PluralForms',
      one: 'stick',
      other: 'sticks',
    },
  },
];

const searchable = (
  query: unknown,
): MockDataFor<typeof SearchUnitsDocument> => ({
  searchUnits: SEARCHED.filter(
    unit => typeof query === 'string' && !!unit.name?.startsWith(query),
  ),
});

/** 5 kg of flour, sized by nothing: the stack most tests edit. */
const flour: Stack = {
  id: 'item-1',
  itemName: 'Flour',
  quantity: 5,
  unit: KILOGRAM,
  displayUnit: null,
  netWeight: null,
  netWeightUnit: null,
  packageSize: null,
  storageState: StorageState.Ambient,
};

const SAVED = gql`
  fragment PantryItemFormTestSaved on PantryItem {
    quantity
    storageState
    tags
    storageLocation {
      id
      name
    }
  }
`;

/** The stack as the cache holds it, the pending write included. */
const saved = (cache: InMemoryCache) =>
  cache.readFragment<{
    quantity: number;
    storageState: StorageState;
    tags: string[];
    storageLocation: { id: string; name: string } | null;
  }>({ id: 'PantryItem:item-1', fragment: SAVED, optimistic: true });

let log = operationLog();

interface Render {
  /** The stack the edit read answers with. */
  stack?: Stack;
  /** Answers that take precedence over the reads every open makes. */
  answers?: ReturnType<typeof recordMock>[];
  cache?: InMemoryCache;
  system?: UnitSystem;
  onSuccess?: () => void;
}

/** The form as the edit screen mounts it, with the app's named fields. */
function renderForm({
  stack = flour,
  answers = [],
  cache = makeCache(),
  system = UnitSystem.Metric,
  onSuccess,
}: Render = {}) {
  writeUnitSystemSettings(cache, system, system);
  renderWithApollo(
    <FieldRendererProvider renderers={catalogFieldRenderers}>
      <PantryItemForm itemId="item-1" onSuccess={onSuccess} />
    </FieldRendererProvider>,
    {
      cache,
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        recordMock(PantryItemForEditDocument, { data: { pantryItem: stack } })
          .mock,
        recordMock(GetHomeDocument, { data: { home: { id: 'h1' } } }).mock,
        recordMock(GetPantryDocument, {
          data: {
            pantry: {
              id: 'p1',
              storageLocationsConnection: {
                edges: [
                  {
                    node: {
                      __typename: 'StorageLocation',
                      id: 'loc-freezer',
                      name: 'Freezer',
                      type: StorageType.Freezer,
                      temperature: StorageState.Frozen,
                    },
                  },
                ],
              },
            },
          },
        }).mock,
        recordMock(SearchUnitsDocument, {
          dataFor: ({ query }) => searchable(query),
        }).mock,
      ],
    },
  );
  return cache;
}

/** The form once its stack and its pantry's locations are read. */
async function openForm(options: Render = {}) {
  const cache = renderForm(options);
  await log.landed(PantryItemForEditDocument);
  await log.landed(GetPantryDocument);
  return cache;
}

const goTo = (page: PageName) =>
  fireEvent.press(
    screen.getByTestId(kitTestIDs.pageIndicator(PAGES.indexOf(page))),
  );

const field = (placeholder: string) => screen.getByPlaceholderText(placeholder);

const saveButton = () => screen.getByTestId(pantryTestIDs.editItemSubmitButton);

const chip = (label: string, selected: boolean) =>
  screen.getByRole('button', { name: label, selected });

/**
 * The search is sent from the render its debounce schedules, and `act` holds
 * renders while awaited: the request is awaited outside it, the answer inside.
 */
async function searchAnswered() {
  await log.requested(SearchUnitsDocument);
  await log.landed(SearchUnitsDocument);
}

/** A save the server accepts, once released. */
const heldUpdate = () =>
  recordMock(UpdatePantryItemDocument, {
    held: true,
    data: {
      updatePantryItem: {
        __typename: 'UpdatePantryItemPayload',
        pantryItem: { id: 'item-1' },
      },
    },
  });

/** Types a location and picks the pantry's freezer from the picker. */
function pickFreezer() {
  goTo('Storage');
  fireEvent.changeText(field(t('itemForm.locationPlaceholder')), 'Fre');
  fireEvent.press(screen.getByText('Freezer'));
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  useStore.setState({
    selectedHomeId: 'h1',
    selectedPantryId: 'p1',
    isOnline: true,
    apiReachable: true,
    cachedUnits: HELD_UNITS,
    lastUnitsFetchedAt: Date.now(),
  });
});

describe('opening the form', () => {
  it('waits on the stack with no Save, never calling it missing', async () => {
    const read = recordMock(PantryItemForEditDocument, {
      data: { pantryItem: flour },
      held: true,
    });
    renderForm({ answers: [read] });
    await act(async () => {
      await log.requested(PantryItemForEditDocument);
    });

    expect(screen.queryByText(t('errors.itemNotFound'))).toBeNull();
    expect(saveButton()).toBeDisabled();

    read.release();
    await log.landed(PantryItemForEditDocument);
    expect(field(t('itemForm.placeholderItemName'))).toHaveDisplayValue(
      'Flour',
    );
  });

  it('says a stack the server no longer has is not found, closable but with no Save', async () => {
    await openForm({
      answers: [
        recordMock(PantryItemForEditDocument, { data: { pantryItem: null } }),
      ],
    });

    expect(screen.getByText(t('errors.itemNotFound'))).toBeTruthy();
    expect(saveButton()).toBeDisabled();
    expect(screen.getByTestId(kitTestIDs.headerCloseButton)).toBeTruthy();
  });

  it('closes by going back', async () => {
    await openForm();

    // Each picker's sheet renders inline in Jest, with its own close; the
    // screen's comes first.
    fireEvent.press(screen.getAllByTestId(kitTestIDs.headerCloseButton)[0]!);

    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  describe('offline', () => {
    const noServer = () =>
      recordMock(PantryItemForEditDocument, {
        error: new Error('This is not available offline yet'),
      });

    beforeEach(() => useStore.setState({ apiReachable: false }));

    it('opens a listed row on what the list holds, with Save', async () => {
      const cache = makeCache();
      seedFragment(cache, {
        fragment: PantryItem_ListedFragmentDoc,
        fragmentName: 'pantryItem_listed',
        data: { __typename: 'PantryItem', id: 'item-1', itemName: 'Flour' },
      });

      await openForm({ cache, answers: [noServer()] });

      expect(field(t('itemForm.placeholderItemName'))).toHaveDisplayValue(
        'Flour',
      );
      expect(saveButton()).toBeEnabled();
    });

    it('says a stack the device does not hold is not available, with no Save', async () => {
      await openForm({ answers: [noServer()] });

      expect(screen.getByTestId(kitTestIDs.stateOffline)).toBeTruthy();
      expect(screen.queryByText(t('errors.itemNotFound'))).toBeNull();
      expect(
        screen.queryByTestId(pantryTestIDs.editItemSubmitButton),
      ).toBeNull();
    });
  });
});

describe('the stack the form opens on', () => {
  it('names it and its brand', async () => {
    await openForm({ stack: { ...flour, brand: { name: 'Acme' } } });

    expect(field(t('itemForm.placeholderItemName'))).toHaveDisplayValue(
      'Flour',
    );
    expect(field(t('itemForm.placeholderBrand'))).toHaveDisplayValue('Acme');
  });

  // The quantity takes a cooking fraction; the decimal-pad fields have no `/`.
  it('states its amounts as each field reads them', async () => {
    await openForm({
      stack: {
        ...flour,
        quantity: 1.33333334,
        minQuantity: 0.33333334,
        restockQuantity: 177.4412,
      },
    });
    goTo('Inventory');

    expect(
      screen.getByTestId(pantryTestIDs.editItemQuantityInput),
    ).toHaveDisplayValue('1 1/3');
    expect(field(t('labels.eG2'))).toHaveDisplayValue('0.333');
    expect(field(t('labels.eG6'))).toHaveDisplayValue('177.441');
    expect(
      screen.getByTestId(pantryTestIDs.editItemUnitPicker),
    ).toHaveDisplayValue('kg');
  });

  it('shows where and how it is kept, and when it expires', async () => {
    await openForm({
      stack: {
        ...flour,
        storageState: StorageState.Frozen,
        condition: ItemCondition.Fair,
        storageLocation: { name: 'Chest freezer' },
        expiresOn: '2026-12-01',
        storageNotes: 'Double-bagged',
      },
    });
    goTo('Storage');

    expect(chip(t('storageState.FROZEN'), true)).toBeTruthy();
    expect(chip(t(conditionLabelKey(ItemCondition.Fair)), true)).toBeTruthy();
    expect(field(t('itemForm.locationPlaceholder'))).toHaveDisplayValue(
      'Chest freezer',
    );
    expect(
      screen.getByText(formatMonthDayYear(fromDateKey('2026-12-01'))),
    ).toBeTruthy();
    expect(field(t('labels.anyAdditionalNotes'))).toHaveDisplayValue(
      'Double-bagged',
    );
  });

  // The cache holds the fields before the read answers. Re-seeding during render
  // updated every mounted field mid-render, which React refuses.
  it('re-seeds from a late answer, keeping what the user typed', async () => {
    const cache = makeCache();
    seedFragment(cache, {
      fragment: PantryItemForm_PantryItemFragmentDoc,
      fragmentName: 'PantryItemForm_pantryItem',
      data: { ...flour, brand: { name: 'Acme' } },
    });
    const read = recordMock(PantryItemForEditDocument, {
      data: {
        pantryItem: {
          ...flour,
          itemName: 'Bread flour',
          brand: { name: 'Bakers' },
        },
      },
      held: true,
    });
    renderForm({ cache, answers: [read] });
    fireEvent.changeText(field(t('itemForm.placeholderItemName')), 'Rye flour');

    read.release();
    await log.landed(PantryItemForEditDocument);

    expect(field(t('itemForm.placeholderItemName'))).toHaveDisplayValue(
      'Rye flour',
    );
    expect(field(t('itemForm.placeholderBrand'))).toHaveDisplayValue('Bakers');
    const renderPhaseUpdates = jest
      .mocked(console.error)
      .mock.calls.filter(([message]) =>
        String(message).includes('Cannot update a component'),
      );
    expect(renderPhaseUpdates).toEqual([]);
  });
});

// The size opens as the detail reads it, so what is saved is what was typed.
describe('the package size, in the user’s units', () => {
  type Reading = NonNullable<NonNullable<Stack['packageSize']>['metric']>;

  const reading = (value: number, id: string, symbol: string): Reading =>
    readingAsAbbreviation({
      __typename: 'MeasureReading',
      value,
      unitId: id,
      symbol,
      displayAsFraction: false,
      type: UnitType.Weight,
    });

  // A 3 lb honey whose size the stack stores as 1360.78 g.
  const honey = (trackingUnitId = 'unit-jar'): Stack => ({
    ...flour,
    unit: { ...KILOGRAM, id: trackingUnitId },
    netWeight: 1360.78,
    netWeightUnit: asAbbreviation({
      __typename: 'Unit',
      id: 'unit-g',
      name: 'gram',
      symbol: 'g',
    }),
    packageSize: {
      __typename: 'Measure',
      value: 1360.78,
      unitId: 'unit-g',
      metric: reading(1.36, 'unit-kg', 'kg'),
      imperial: reading(3, 'unit-lb', 'lb'),
    },
  });

  it.each([
    { system: UnitSystem.Imperial, value: '3', unit: 'lb' },
    { system: UnitSystem.Metric, value: '1.36', unit: 'kg' },
  ])(
    'opens a $system user on $value $unit',
    async ({ system, value, unit }) => {
      await openForm({ stack: honey(), system });
      goTo('Product');

      expect(field(localizeNumericHint(t('labels.eG145')))).toHaveDisplayValue(
        value,
      );
      expect(field(t('labels.ozGMl'))).toHaveDisplayValue(unit);
    },
  );

  it('opens on the stored figure where the reading is the tracking unit', async () => {
    await openForm({ stack: honey('unit-lb'), system: UnitSystem.Imperial });
    goTo('Product');

    expect(field(localizeNumericHint(t('labels.eG145')))).toHaveDisplayValue(
      '1360.78',
    );
    expect(field(t('labels.ozGMl'))).toHaveDisplayValue('g');
  });
});

describe('where it is kept', () => {
  it("takes a picked location's temperature", async () => {
    await openForm();

    pickFreezer();

    expect(chip(t('storageState.FROZEN'), true)).toBeTruthy();
  });

  it('saves a picked location as that location', async () => {
    const update = heldUpdate();
    const cache = await openForm({ answers: [update] });
    pickFreezer();

    fireEvent.press(saveButton());
    await log.requested(UpdatePantryItemDocument);

    expect(saved(cache)?.storageLocation).toEqual({
      __typename: 'StorageLocation',
      id: 'loc-freezer',
      name: 'Freezer',
    });
  });

  it('saves a picked storage state', async () => {
    const update = heldUpdate();
    const cache = await openForm({ answers: [update] });
    goTo('Storage');

    fireEvent.press(chip(t('storageState.FROZEN'), false));
    fireEvent.press(saveButton());
    await log.requested(UpdatePantryItemDocument);

    expect(saved(cache)?.storageState).toBe(StorageState.Frozen);
  });
});

describe('saving', () => {
  it('holds Save while the save is in flight, and reports success once it lands', async () => {
    const onSuccess = jest.fn();
    const update = heldUpdate();
    await openForm({ answers: [update], onSuccess });
    fireEvent.changeText(field(t('itemForm.placeholderItemName')), 'Rye flour');

    fireEvent.press(saveButton());
    await log.requested(UpdatePantryItemDocument);

    expect(saveButton()).toBeDisabled();
    expect(onSuccess).not.toHaveBeenCalled();

    update.release();
    await log.landed(UpdatePantryItemDocument);
    expect(onSuccess).toHaveBeenCalledTimes(1);
    expect(saveButton()).toBeEnabled();
  });

  it('keeps tags under More options, and saves them as a list', async () => {
    const update = heldUpdate();
    const cache = await openForm({
      stack: { ...flour, tags: [] },
      answers: [update],
    });
    goTo('Inventory');

    fireEvent.press(
      screen.getByRole('button', { name: t('labels.moreOptions') }),
    );
    const tags = field(t('itemForm.tagsPlaceholder'));
    fireEvent.changeText(tags, ' baking , gluten ');
    fireEvent(tags, 'blur');
    fireEvent.press(saveButton());
    await log.requested(UpdatePantryItemDocument);

    expect(saved(cache)?.tags).toEqual(['baking', 'gluten']);
  });
});

describe('the quantity', () => {
  it('reports unreadable text on the field, and saves a corrected amount', async () => {
    const update = recordMock(UpdatePantryItemQuantityDocument, {
      held: true,
      data: {
        updatePantryItemQuantity: {
          __typename: 'UpdatePantryItemQuantityPayload',
          pantryItem: { id: 'item-1' },
        },
      },
    });
    const cache = await openForm({ answers: [update] });
    goTo('Inventory');
    const quantity = screen.getByTestId(pantryTestIDs.editItemQuantityInput);
    const user = userEvent.setup();

    await user.clear(quantity);
    await user.type(quantity, 'abc');
    expect(screen.getByText(t('errors.invalidQuantity'))).toBeTruthy();

    await user.clear(quantity);
    await user.type(quantity, '2');
    expect(screen.queryByText(t('errors.invalidQuantity'))).toBeNull();

    fireEvent.press(saveButton());
    await log.requested(UpdatePantryItemQuantityDocument);
    expect(saved(cache)?.quantity).toBe(2);
  });

  // The device does not hold a stick, so only the pick says which unit it is.
  it('previews a change to the unit picked from the search', async () => {
    const preview = recordMock(PreviewPantryItemUnitChangeDocument, {
      held: true,
    });
    await openForm({ answers: [preview] });
    goTo('Inventory');

    fireEvent.changeText(
      screen.getByTestId(pantryTestIDs.editItemUnitPicker),
      'stick',
    );
    await searchAnswered();
    fireEvent.press(
      screen.getByTestId(
        catalogTestIDs.suggestion(pantryTestIDs.editItemUnitPicker, 0),
      ),
    );
    fireEvent.press(saveButton());
    await act(async () => {
      await log.requested(PreviewPantryItemUnitChangeDocument);
    });

    expect(preview.fired).toContainEqual({
      input: expect.objectContaining({
        pantryItemId: 'item-1',
        unitId: 'unit-stick',
      }),
    });
  });
});

describe('the net weight', () => {
  it('asks for the unit of a typed weight until one is picked', async () => {
    await openForm();
    goTo('Product');

    await userEvent
      .setup()
      .type(field(localizeNumericHint(t('labels.eG145'))), '1');
    expect(
      screen.getByText(t('labels.pleaseSelectAUnitForTheNetWeight')),
    ).toBeTruthy();

    fireEvent.changeText(field(t('labels.ozGMl')), 'pou');
    await searchAnswered();
    fireEvent.press(screen.getByText('pound'));

    expect(
      screen.queryByText(t('labels.pleaseSelectAUnitForTheNetWeight')),
    ).toBeNull();
  });

  it('reports a unit the API does not know on its field, from any page', async () => {
    await openForm({
      answers: [
        recordMock(GetUnitBySymbolDocument, { data: { unitBySymbol: null } }),
      ],
    });
    goTo('Product');
    fireEvent.changeText(field(localizeNumericHint(t('labels.eG145'))), '2');
    fireEvent.changeText(field(t('labels.ozGMl')), 'blorp');
    await searchAnswered();
    goTo('Basics');

    fireEvent.press(saveButton());
    await log.landed(GetUnitBySymbolDocument);

    expect(
      screen.getByRole('tab', {
        name: t(PAGE_LABEL_KEYS.Product),
        selected: true,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(t('itemForm.unknownUnit', { unit: 'blorp' })),
    ).toBeTruthy();
  });
});
