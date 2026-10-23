import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { TabScreenHeader } from '#components/molecules/TabScreenHeader';
import { ExpandChevron } from '#components/atoms/ExpandChevron';
import type { BarAction } from '#components/molecules/BarActions';

const action = (key: string): BarAction => ({
  icon: 'add',
  accessibilityLabel: key,
  onPress: jest.fn(),
  testID: key,
});

describe('TabScreenHeader', () => {
  it('shows its title as its only text', () => {
    render(<TabScreenHeader title="Recipes" />);
    expect(screen.getByText('Recipes')).toBeTruthy();
    expect(screen.UNSAFE_queryByType(ExpandChevron)).toBeNull();
  });

  it('holds two actions', () => {
    render(
      <TabScreenHeader title="Plan" actions={[action('a'), action('b')]} />,
    );
    expect(screen.getByTestId('a')).toBeTruthy();
    expect(screen.getByTestId('b')).toBeTruthy();
  });

  it('refuses a third action, which belongs in one of the two', () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <TabScreenHeader
          title="Plan"
          actions={[action('a'), action('b'), action('c')]}
        />,
      ),
    ).toThrow(/at most 2/);
    jest.restoreAllMocks();
  });

  it('opens the picker from a title that names a switchable thing', () => {
    const onPress = jest.fn();
    render(
      <TabScreenHeader
        title="Weekly"
        switchable={{
          onPress,
          testID: 'title-switch',
          accessibilityHint: 'Switch plan',
        }}
      />,
    );
    expect(screen.UNSAFE_getByType(ExpandChevron)).toBeTruthy();
    const title = screen.getByTestId('title-switch');
    expect(title.props.accessibilityHint).toBe('Switch plan');
    fireEvent.press(title);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});
