import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PhotoCredit } from '#features/catalog/ui/PhotoCredit';
import { catalogTestIDs } from '#features/catalog/testIDs';

const CREDIT = {
  text: 'Open Food Facts',
  license: 'CC BY-SA 3.0',
  licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  sourceUrl: 'https://world.openfoodfacts.org/product/0011110092175',
};

const openURL = jest.spyOn(Linking, 'openURL');

beforeEach(() => {
  openURL.mockReset();
  openURL.mockResolvedValue(true);
});

describe('PhotoCredit', () => {
  it('names the source and the licence', () => {
    render(<PhotoCredit credit={CREDIT} />);

    expect(screen.getByText('Photo: Open Food Facts')).toBeTruthy();
    expect(screen.getByText('CC BY-SA 3.0')).toBeTruthy();
  });

  it('links the credit to the photo page and the licence to its text', () => {
    render(<PhotoCredit credit={CREDIT} overPhoto />);

    fireEvent.press(screen.getByTestId(catalogTestIDs.photoCreditSource));
    fireEvent.press(screen.getByTestId(catalogTestIDs.photoCreditLicense));

    expect(openURL.mock.calls).toEqual([
      [CREDIT.sourceUrl],
      [CREDIT.licenseUrl],
    ]);
  });

  it('opens nothing for a link that is not a web address', () => {
    render(<PhotoCredit credit={{ ...CREDIT, sourceUrl: 'tel:5551234' }} />);

    fireEvent.press(screen.getByTestId(catalogTestIDs.photoCreditSource));

    expect(openURL).not.toHaveBeenCalled();
  });
});
