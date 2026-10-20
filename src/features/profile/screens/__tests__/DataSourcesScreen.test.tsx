import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DataSourcesScreen } from '../DataSourcesScreen';
import { profileTestIDs } from '#features/profile/testIDs';

/**
 * Open Food Facts' ODbL and CC BY-SA require attribution wherever its data is
 * used, so the screen must name every source with its licence.
 */
describe('DataSourcesScreen', () => {
  it('names every source with its licence', () => {
    render(<DataSourcesScreen />);

    expect(screen.getByText('Open Food Facts')).toBeTruthy();
    expect(
      screen.getByText(
        'Database: Open Database License (ODbL). Photos: Creative Commons Attribution-ShareAlike (CC BY-SA).',
      ),
    ).toBeTruthy();
    expect(screen.getByText('USDA FoodData Central')).toBeTruthy();
    expect(screen.getByText('USDA FoodKeeper')).toBeTruthy();
    expect(
      screen.getAllByText('Public domain (a U.S. government work).'),
    ).toHaveLength(2);
  });

  it("opens a source's website", () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    render(<DataSourcesScreen />);

    fireEvent.press(
      screen.getByTestId(profileTestIDs.dataSourceLink('openFoodFacts')),
    );

    expect(openURL).toHaveBeenCalledWith('https://world.openfoodfacts.org');
    openURL.mockRestore();
  });
});
