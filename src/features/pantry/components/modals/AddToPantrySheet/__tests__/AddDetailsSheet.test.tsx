import React from 'react';

import { fireEvent, screen, userEvent } from '@testing-library/react-native';
import {
  type MockDataFor,
  recordMock,
  renderWithApollo,
} from '#/test-utils/apolloMockProvider';
import { operationLog } from '#/test-utils/operationLog';
import { asAbbreviation } from '#/test-utils/fixtures/unitLabels';
import { useStore } from '#store';
import { t } from '#/i18n';
import { requirePlatform } from '#platform/install';
import {
  StorageState,
  StorageType,
  UnitType,
} from '#/graphql/generated/schemaTypes';
import { alertService } from '#/services/alertService';
import { CreatePantryItemDocument } from '#features/pantry/graphql/pantry.generated';
import { SearchUnitsDocument } from '#operations/item/unit.generated';
import { pantryTestIDs } from '#features/pantry/testIDs';
import type { StorageLocationOption } from '#features/catalog/hooks/useStorageLocationAutocomplete';
import { AddDetailsSheet } from '../AddDetailsSheet';

type Props = React.ComponentProps<typeof AddDetailsSheet>;
type SearchedUnit = NonNullable<
  MockDataFor<typeof SearchUnitsDocument>['searchUnits']
>[number];

const unit = (
  id: string,
  name: string,
  symbol: string,
  type: UnitType,
): SearchedUnit => ({
  ...asAbbreviation({ __typename: 'Unit', id, name, symbol, type }),
  localizedNameForms: { __typename: 'PluralForms', one: name, other: name },
});

/** What the unit search finds: cans and packs to count by, ounces to size them. */
const SEARCHED = [
  unit('can', 'can', 'can', UnitType.Count),
  unit('pack', 'pack', 'pack', UnitType.Count),
  unit('oz', 'ounce', 'oz', UnitType.Weight),
];

const location = (
  id: string,
  name: string,
  temperature: StorageState | null,
): StorageLocationOption => ({
  id,
  name,
  type: StorageType.Cabinet,
  isDefault: false,
  temperature,
});
const LOCATIONS = [
  location('loc-freezer', 'Chest freezer', StorageState.Frozen),
  location('loc-shelf', 'Garage shelf', StorageState.None),
];

let log = operationLog();

const onClose = jest.fn();
const onSuccess = jest.fn();

function renderSheet(
  over: Partial<Props> = {},
  answers: ReturnType<typeof recordMock>[] = [],
) {
  return renderWithApollo(
    <AddDetailsSheet
      pantryId="pantry-1"
      storageLocations={LOCATIONS}
      onClose={onClose}
      onSuccess={onSuccess}
      {...over}
    />,
    {
      links: [log.link],
      operationMocks: [
        ...answers.map(answer => answer.mock),
        recordMock(SearchUnitsDocument, {
          dataFor: ({ query }) => ({
            searchUnits: SEARCHED.filter(
              searched =>
                typeof query === 'string' && !!searched.name?.startsWith(query),
            ),
          }),
        }).mock,
      ],
    },
  );
}

const tab = (title: string) => screen.getByRole('tab', { name: title });
const submit = () =>
  userEvent
    .setup()
    .press(screen.getByTestId(pantryTestIDs.addDetailsSubmitButton));

let searches = 0;

/** Types a unit into a unit field and picks it from the search. */
async function pickUnit(fieldTestID: string, typed: string, name: string) {
  searches += 1;
  fireEvent.changeText(screen.getByTestId(fieldTestID), typed);
  await log.requested(SearchUnitsDocument, searches);
  await log.landed(SearchUnitsDocument, searches);
  // Through `userEvent`, whose act settles the validation the pick starts.
  await userEvent.setup().press(screen.getByText(name));
}

beforeEach(() => {
  jest.clearAllMocks();
  log = operationLog();
  searches = 0;
  useStore.setState({
    isOnline: true,
    apiReachable: true,
    cachedUnits: [],
    lastUnitsFetchedAt: Date.now(),
  });
});

describe('the sheet', () => {
  it('starts on the main page of four', () => {
    renderSheet();

    expect(screen.getByText(t('addToPantry.addItemDetails'))).toBeTruthy();
    expect(
      tab(t('addToPantry.pageMain')).props.accessibilityState,
    ).toMatchObject({ selected: true });
    for (const title of [
      t('labels.details'),
      t('labels.storage'),
      t('addToPantry.pageStock'),
    ]) {
      expect(tab(title)).toBeTruthy();
    }
  });

  it('moves to a page from its tab', () => {
    renderSheet();

    fireEvent.press(tab(t('labels.storage')));

    expect(tab(t('labels.storage')).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });

  it('carries in the name that was searched for', () => {
    renderSheet({ prefilledItemName: 'Olive Oil' });

    expect(
      screen.getByTestId(pantryTestIDs.addDetailsNameInput),
    ).toHaveDisplayValue('Olive Oil');
  });
});

describe('adding', () => {
  it('refuses an unnamed item on its field, from any page, and says so aloud', async () => {
    const announce = jest.spyOn(requirePlatform('screenReader'), 'announce');
    const create = recordMock(CreatePantryItemDocument, { held: true });
    renderSheet({}, [create]);
    fireEvent.press(tab(t('addToPantry.pageStock')));

    await submit();

    expect(screen.getByText(t('errors.itemNameRequired'))).toBeTruthy();
    expect(
      tab(t('addToPantry.pageMain')).props.accessibilityState,
    ).toMatchObject({ selected: true });
    expect(announce).toHaveBeenCalledWith(t('errors.itemNameRequired'));
    expect(create.fired).toEqual([]);
    announce.mockRestore();
  });

  it('says it is adding while the item is created, and reports success once it lands', async () => {
    const create = recordMock(CreatePantryItemDocument, {
      held: true,
      data: {
        createPantryItem: {
          __typename: 'CreatePantryItemPayload',
          pantryItem: { id: 'stack-1' },
        },
      },
    });
    renderSheet({ prefilledItemName: 'Olive Oil' }, [create]);

    await submit();
    await log.requested(CreatePantryItemDocument);

    expect(screen.getByText(t('labels.adding'))).toBeTruthy();
    expect(create.fired[0]).toMatchObject({
      input: { item: { inline: { name: 'Olive Oil' } } },
    });

    create.release();
    await log.landed(CreatePantryItemDocument);
    expect(onSuccess).toHaveBeenCalledTimes(1);
  });
});

describe('as it is typed', () => {
  it('reports a quantity that is no amount', async () => {
    renderSheet({ prefilledItemName: 'Oats' });
    fireEvent.press(tab(t('labels.details')));
    const user = userEvent.setup();
    const quantity = screen.getByTestId(pantryTestIDs.addDetailsQuantityInput);

    await user.clear(quantity);
    await user.type(quantity, 'abc');

    expect(screen.getByText(t('errors.invalidQuantity'))).toBeTruthy();
  });
});

describe('cancelling', () => {
  it('closes an untouched form at once', () => {
    renderSheet();

    fireEvent.press(screen.getByTestId(pantryTestIDs.addDetailsCancelButton));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(alertService.alert).not.toHaveBeenCalled();
  });

  it('asks before dropping what was typed, and holds the sheet open', async () => {
    const onHoldOpen = jest.fn();
    renderSheet({ onHoldOpen });
    await userEvent
      .setup()
      .type(screen.getByTestId(pantryTestIDs.addDetailsNameInput), 'Oats');

    fireEvent.press(screen.getByTestId(pantryTestIDs.addDetailsCancelButton));

    expect(onHoldOpen).toHaveBeenLastCalledWith(true);
    expect(onClose).not.toHaveBeenCalled();
    expect(alertService.alert).toHaveBeenCalledWith(
      t('confirmations.discardChangesTitle'),
      t('confirmations.discardChanges'),
      expect.any(Array),
    );
  });
});

describe('what one package holds', () => {
  const SIZE_UNIT_REQUIRED = () => t('packageSize.unitRequired');

  /** Counts the item in cans, which asks what one holds. */
  const countInCans = async () => {
    fireEvent.press(tab(t('labels.details')));
    await pickUnit(pantryTestIDs.addDetailsUnitPicker, 'can', 'can');
  };

  it('is asked of a count, and not of an item measured by weight', async () => {
    renderSheet({ prefilledItemName: 'Flour' });
    fireEvent.press(tab(t('labels.details')));
    expect(screen.getByTestId(pantryTestIDs.addDetailsSizeInput)).toBeTruthy();

    await pickUnit(pantryTestIDs.addDetailsUnitPicker, 'oun', 'ounce');

    expect(screen.queryByTestId(pantryTestIDs.addDetailsSizeInput)).toBeNull();
  });

  it('asks for the size’s unit on its field, once a size is typed', async () => {
    renderSheet({ prefilledItemName: 'Tuna' });
    await countInCans();

    fireEvent.changeText(
      screen.getByTestId(pantryTestIDs.addDetailsSizeInput),
      '5',
    );
    expect(screen.queryByText(SIZE_UNIT_REQUIRED())).toBeNull();
    await submit();

    expect(screen.getByText(SIZE_UNIT_REQUIRED())).toBeTruthy();
  });

  it('says nothing while the size’s unit is being typed', async () => {
    renderSheet({ prefilledItemName: 'Tuna' });
    await countInCans();

    fireEvent.changeText(
      screen.getByTestId(pantryTestIDs.addDetailsSizeInput),
      '5',
    );
    await userEvent
      .setup()
      .type(screen.getByTestId(pantryTestIDs.addDetailsSizeUnitPicker), 'ou');

    expect(screen.queryByText(SIZE_UNIT_REQUIRED())).toBeNull();
  });

  it('clears that message once the size’s unit is picked', async () => {
    renderSheet({ prefilledItemName: 'Tuna' });
    await countInCans();
    fireEvent.changeText(
      screen.getByTestId(pantryTestIDs.addDetailsSizeInput),
      '5',
    );
    await submit();
    expect(screen.getByText(SIZE_UNIT_REQUIRED())).toBeTruthy();

    await pickUnit(pantryTestIDs.addDetailsSizeUnitPicker, 'oun', 'ounce');

    expect(screen.queryByText(SIZE_UNIT_REQUIRED())).toBeNull();
  });

  it('drops that message once the size is cleared', async () => {
    renderSheet({ prefilledItemName: 'Tuna' });
    await countInCans();
    fireEvent.changeText(
      screen.getByTestId(pantryTestIDs.addDetailsSizeInput),
      '5',
    );
    await submit();
    expect(screen.getByText(SIZE_UNIT_REQUIRED())).toBeTruthy();

    await userEvent
      .setup()
      .clear(screen.getByTestId(pantryTestIDs.addDetailsSizeInput));

    expect(screen.queryByText(SIZE_UNIT_REQUIRED())).toBeNull();
  });

  it('sends the size in the unit it was picked in', async () => {
    const create = recordMock(CreatePantryItemDocument, { held: true });
    renderSheet({ prefilledItemName: 'Tuna' }, [create]);
    await countInCans();
    fireEvent.changeText(
      screen.getByTestId(pantryTestIDs.addDetailsSizeInput),
      '5',
    );
    await pickUnit(pantryTestIDs.addDetailsSizeUnitPicker, 'oun', 'ounce');

    await submit();
    await log.requested(CreatePantryItemDocument);

    expect(create.fired[0]).toMatchObject({
      input: { netWeight: { netWeight: 5, netWeightUnitId: 'oz' } },
    });
  });

  it('sends a count inside a count as portions of it', async () => {
    const create = recordMock(CreatePantryItemDocument, { held: true });
    renderSheet({ prefilledItemName: 'Soda' }, [create]);
    fireEvent.press(tab(t('labels.details')));
    await pickUnit(pantryTestIDs.addDetailsUnitPicker, 'pa', 'pack');
    fireEvent.changeText(
      screen.getByTestId(pantryTestIDs.addDetailsSizeInput),
      '6',
    );
    await pickUnit(pantryTestIDs.addDetailsSizeUnitPicker, 'can', 'can');

    await submit();
    await log.requested(CreatePantryItemDocument);

    expect(create.fired[0]).toMatchObject({
      input: {
        measurementProfile: {
          portionUnitId: 'can',
          portionsPerTrackingUnit: 6,
        },
      },
    });
  });
});

describe('where it is kept', () => {
  const stateChosen = (state: StorageState) =>
    screen.getByRole('radio', {
      name: t(`storageState.${state}`),
      checked: true,
    });

  /** Types a location and picks it from the pantry's. */
  const pickLocation = (typed: string, name: string) => {
    fireEvent.press(tab(t('labels.storage')));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('addToPantry.storageLocationPlaceholder')),
      typed,
    );
    fireEvent.press(screen.getByText(name));
  };

  it("takes a picked location's temperature", () => {
    renderSheet();
    expect(stateChosen(StorageState.Ambient)).toBeTruthy();

    pickLocation('Chest', 'Chest freezer');

    expect(stateChosen(StorageState.Frozen)).toBeTruthy();
  });

  it('leaves the chosen state alone for a location with no temperature control', () => {
    renderSheet();
    pickLocation('Chest', 'Chest freezer');

    pickLocation('Gar', 'Garage shelf');

    expect(stateChosen(StorageState.Frozen)).toBeTruthy();
  });

  // Typing reached the form only after a pause, so a location saved straight
  // after typing it was dropped.
  it('keeps a location typed and saved at once', async () => {
    const create = recordMock(CreatePantryItemDocument, { held: true });
    renderSheet({ prefilledItemName: 'Oats' }, [create]);
    fireEvent.press(tab(t('labels.storage')));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('addToPantry.storageLocationPlaceholder')),
      'Attic',
    );

    await submit();
    await log.requested(CreatePantryItemDocument);

    expect(create.fired[0]).toMatchObject({
      input: { storage: { location: { name: 'Attic' } } },
    });
  });

  it('sends a new location by its name, not the last one picked', async () => {
    const create = recordMock(CreatePantryItemDocument, { held: true });
    renderSheet({ prefilledItemName: 'Oats' }, [create]);
    pickLocation('Chest', 'Chest freezer');
    fireEvent.changeText(
      screen.getByPlaceholderText(t('addToPantry.storageLocationPlaceholder')),
      'Attic',
    );
    fireEvent.press(screen.getByText(t('labels.addNamed', { name: 'Attic' })));

    await submit();
    await log.requested(CreatePantryItemDocument);

    expect(create.fired[0]).toMatchObject({
      input: { storage: { location: { name: 'Attic' } } },
    });
  });
});
