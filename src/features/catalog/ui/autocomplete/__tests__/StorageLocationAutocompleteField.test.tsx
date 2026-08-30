import React from 'react';
import { render, fireEvent, screen } from '@testing-library/react-native';
import { StorageType } from '#/graphql/generated/schemaTypes';
import type { StorageLocation } from '#/graphql/generated/schemaTypes';
import { StorageLocationAutocompleteField } from '../StorageLocationAutocompleteField';

/**
 * What this field puts in the FORM VALUE, not what it renders.
 *
 * The text is load-bearing: the pantry create/update paths send it as
 * `storage.storageLocationName` whenever no id is selected, and the server
 * resolves that name at the ROOT level only — it never matches a nested
 * location. So a parent-decorated value could not name the location it came
 * from; it find-or-created a new root location called `"Child (Parent)"` in the
 * shared home, and the next member to open the picker saw it.
 */

const location = (over: Partial<StorageLocation>): StorageLocation =>
  ({
    __typename: 'StorageLocation',
    id: 'loc-1',
    name: 'Freezer',
    type: StorageType.Freezer,
    isDefault: false,
    parentLocation: null,
    ...over,
  } as StorageLocation);

const nested = location({
  id: 'loc-nested',
  name: 'Freezer',
  parentLocation: location({ id: 'loc-parent', name: 'Kitchen Fridge' }),
});

function renderField(
  onChangeText: (t: string) => void,
  onSelected = jest.fn(),
) {
  return render(
    <StorageLocationAutocompleteField
      variant="inline"
      value=""
      onChangeText={onChangeText}
      storageLocations={[nested]}
      onStorageLocationSelected={onSelected}
      testID="location-field"
    />,
  );
}

describe('StorageLocationAutocompleteField', () => {
  it('writes the location OWN name when a nested location is picked', () => {
    const onChangeText = jest.fn();
    const onSelected = jest.fn();
    renderField(onChangeText, onSelected);

    // Type enough to surface the suggestion, then pick it.
    fireEvent.changeText(screen.getByTestId('location-field'), 'Free');
    fireEvent.press(screen.getByText('Freezer'));

    expect(onChangeText).toHaveBeenLastCalledWith('Freezer');
    // The parent is never appended — that string could only ever create a new
    // root location, never resolve to this one.
    expect(onChangeText).not.toHaveBeenCalledWith(
      expect.stringContaining('Kitchen Fridge'),
    );
    // The nested location stays reachable, by id.
    expect(onSelected).toHaveBeenLastCalledWith('loc-nested', nested);
  });

  it('shows which parent a location sits under on the row', () => {
    renderField(jest.fn());
    fireEvent.changeText(screen.getByTestId('location-field'), 'Free');

    // Disambiguation belongs on the row, where it never enters form state.
    expect(screen.getByText('Inside Kitchen Fridge')).toBeTruthy();
  });
});
