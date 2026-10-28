import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { DataAttributionNotices } from '#features/recipes/components/DataAttributionNotices';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { ExternalSource } from '#/graphql/generated/schemaTypes';

const OFF = {
  source: ExternalSource.Openfoodfacts,
  notice: 'Product data from Open Food Facts, available under the ODbL.',
  licenseUrl: 'https://opendatacommons.org/licenses/odbl/1-0/',
  sourceUrl: 'https://world.openfoodfacts.org/product/0011110092175',
};
const USDA = {
  source: ExternalSource.Usda,
  notice: 'U.S. Department of Agriculture, FoodData Central.',
  licenseUrl: null,
  sourceUrl: null,
};

const openURL = jest.spyOn(Linking, 'openURL');

beforeEach(() => {
  openURL.mockReset();
  openURL.mockResolvedValue(true);
});

describe('DataAttributionNotices', () => {
  it('shows each notice as the API words it', () => {
    render(<DataAttributionNotices attributions={[OFF, USDA]} />);

    expect(screen.getByText(OFF.notice)).toBeTruthy();
    expect(screen.getByText(USDA.notice)).toBeTruthy();
  });

  it('links a notice to its source and its licence', () => {
    render(<DataAttributionNotices attributions={[OFF]} />);

    fireEvent.press(
      screen.getByTestId(recipesTestIDs.dataAttributionSource(OFF.source)),
    );
    fireEvent.press(
      screen.getByTestId(recipesTestIDs.dataAttributionLicense(OFF.source)),
    );

    expect(openURL.mock.calls).toEqual([[OFF.sourceUrl], [OFF.licenseUrl]]);
  });

  // One paragraph, so a long notice wraps as text and the licence follows it
  // instead of taking a line of its own.
  it('runs the licence on after its notice', () => {
    render(<DataAttributionNotices attributions={[OFF]} />);

    expect(screen.getByText(`${OFF.notice} · License`)).toBeTruthy();
  });

  it('offers no link a notice does not name', () => {
    render(<DataAttributionNotices attributions={[USDA]} />);

    expect(
      screen.queryByTestId(recipesTestIDs.dataAttributionSource(USDA.source)),
    ).toBeNull();
    expect(screen.queryByText('License')).toBeNull();
  });

  it('renders nothing without a notice', () => {
    render(<DataAttributionNotices attributions={[]} />);

    expect(screen.toJSON()).toBeNull();
  });
});
