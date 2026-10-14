import React from 'react';
import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Link } from '#components/atoms/Link';

const openURL = jest.spyOn(Linking, 'openURL');

beforeEach(() => {
  openURL.mockReset();
  openURL.mockResolvedValue(true);
});

describe('Link', () => {
  it('opens its web address', () => {
    render(<Link href="https://world.openfoodfacts.org">Visit</Link>);

    fireEvent.press(screen.getByRole('link', { name: 'Visit' }));

    expect(openURL).toHaveBeenCalledWith('https://world.openfoodfacts.org');
  });

  it('opens nothing for an address that is not a web one', () => {
    render(<Link href="tel:5551234">Call</Link>);

    fireEvent.press(screen.getByRole('link', { name: 'Call' }));

    expect(openURL).not.toHaveBeenCalled();
  });

  it('runs its handler when it names no address', () => {
    const onPress = jest.fn();
    render(<Link onPress={onPress}>Resend</Link>);

    fireEvent.press(screen.getByRole('link', { name: 'Resend' }));

    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
