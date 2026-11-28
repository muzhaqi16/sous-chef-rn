import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { t } from '#i18n';
import { StorageLocationSheet } from '#features/catalog/ui/StorageLocationSheet/StorageLocationSheet';
import type { StorageLocationInitialData } from '#features/catalog/ui/StorageLocationSheet/StorageLocationSheet';
import { StorageType } from '#graphql/generated/schemaTypes';

const onSubmit = jest.fn(() => Promise.resolve(true));
const onClose = jest.fn();

/** The form as its sheet hosts it, with the sheet's bar and its confirm. */
const renderSheet = ({
  initialData,
  availableLocations = [],
}: {
  initialData?: StorageLocationInitialData;
  availableLocations?: Array<{ id: string; name: string; type: StorageType }>;
} = {}) =>
  render(
    <StorageLocationSheet
      visible
      onClose={onClose}
      onSubmit={onSubmit}
      initialData={initialData}
      availableLocations={availableLocations}
    />,
  );

const NAME_PLACEHOLDER = () => t('storageLocationForm.namePlaceholder');
const confirm = (label: string) =>
  userEvent.setup().press(screen.getByLabelText(label));
const cellar = (over: Partial<StorageLocationInitialData> = {}) => ({
  id: 'loc-9',
  name: 'Wine Cellar',
  type: StorageType.Refrigerator,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
});

describe('StorageLocationForm', () => {
  it('names the field and offers the storage types', () => {
    renderSheet();
    expect(screen.getByPlaceholderText(NAME_PLACEHOLDER())).toBeTruthy();
    expect(screen.getByText(t('storageLocationForm.type'))).toBeTruthy();
    expect(screen.getByText('Refrigerator')).toBeTruthy();
    expect(screen.getByText('Pantry Shelf')).toBeTruthy();
  });

  it('adds a new location, confirmed as Create', () => {
    renderSheet();
    expect(screen.getByText(t('storageLocationSheet.addTitle'))).toBeTruthy();
    expect(screen.getByLabelText(t('labels.create'))).toBeTruthy();
  });

  it('edits from the location it was given, confirmed as Update', () => {
    renderSheet({ initialData: cellar({ name: 'Kitchen Fridge' }) });
    expect(screen.getByText(t('storageLocationSheet.editTitle'))).toBeTruthy();
    expect(screen.getByDisplayValue('Kitchen Fridge')).toBeTruthy();
    expect(screen.getByLabelText(t('labels.update'))).toBeTruthy();
  });

  it('offers a parent only when there are other locations', () => {
    renderSheet({
      availableLocations: [
        { id: 'loc-1', name: 'Main Fridge', type: StorageType.Refrigerator },
      ],
    });
    expect(screen.getByText('Parent Location (Optional)')).toBeTruthy();
    expect(screen.getByText('Main Fridge')).toBeTruthy();
  });

  it('sends the name typed, trimmed, then closes', async () => {
    renderSheet();
    fireEvent.changeText(
      screen.getByPlaceholderText(NAME_PLACEHOLDER()),
      '  Test Location  ',
    );
    await confirm(t('labels.create'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Location',
        type: StorageType.PantryShelf,
      }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it('says on the field that a name is needed, and sends nothing', async () => {
    renderSheet();
    await confirm(t('labels.create'));

    expect(screen.getByText(t('addStorageLocation.nameRequired'))).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('holds a name to the same rule as the quick add', async () => {
    renderSheet();
    fireEvent.changeText(screen.getByPlaceholderText(NAME_PLACEHOLDER()), 'K');
    await confirm(t('labels.create'));

    expect(screen.getByText(t('commonValidation.nameMin'))).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('says on the field that a capacity it cannot read is refused', async () => {
    renderSheet({ initialData: cellar() });
    await userEvent
      .setup()
      .press(screen.getByText(t('storageLocationForm.advancedSettings')));
    fireEvent.changeText(
      screen.getByPlaceholderText(t('storageLocationForm.capacityPlaceholder')),
      'lots',
    );
    await confirm(t('labels.update'));

    expect(screen.getByText(t('errors.invalidQuantity'))).toBeTruthy();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('keeps the sheet open when the save is refused', async () => {
    onSubmit.mockResolvedValueOnce(false);
    renderSheet({ initialData: cellar() });
    await confirm(t('labels.update'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('sends false for a flag the user unticks', async () => {
    const user = userEvent.setup();
    renderSheet({
      initialData: cellar({ isClimateControlled: true, isDefault: false }),
    });
    await user.press(screen.getByText('Advanced Settings'));
    await user.press(screen.getByText('Climate Controlled'));
    await confirm(t('labels.update'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ isClimateControlled: false, isDefault: false }),
    );
  });

  it('turns the default on for a location that is not it', async () => {
    const user = userEvent.setup();
    renderSheet({ initialData: cellar({ isDefault: false }) });
    await user.press(screen.getByText('Advanced Settings'));
    await user.press(screen.getByText('Set as Default Location'));
    await confirm(t('labels.update'));

    expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({ isDefault: true }),
    );
  });

  // The API refuses unsetting the current default: it moves only by another
  // location taking it.
  it('offers no default box and states no default when editing the current default', async () => {
    const user = userEvent.setup();
    renderSheet({ initialData: cellar({ isDefault: true }) });
    await user.press(screen.getByText('Advanced Settings'));
    expect(screen.queryByText('Set as Default Location')).toBeNull();
    await confirm(t('labels.update'));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    const [[submitted]] = jest.mocked(onSubmit).mock.calls as unknown as [
      [object],
    ];
    expect(submitted).not.toHaveProperty('isDefault');
  });
});
