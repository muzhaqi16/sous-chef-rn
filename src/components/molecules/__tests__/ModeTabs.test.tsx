import React from 'react';
import { ScrollView } from 'react-native';
import { StyleSheet } from 'react-native-unistyles';
import { Text } from '#components/atoms/Text';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ModeTabs } from '../ModeTabs';

const renderTabs = (onChange = jest.fn()) =>
  render(
    <ModeTabs
      options={['shopping', 'purchased']}
      value="shopping"
      onChange={onChange}
      formatLabel={option =>
        option === 'shopping' ? 'Për të blerë' : 'Të blera'
      }
      countOf={() => 12}
      tabTestID={option => `tab-${option}`}
      trailing={
        <Text role="label" testID="clear">
          Pastro
        </Text>
      }
    />,
  );

describe('ModeTabs', () => {
  // A long language at a large text size: the tabs scroll, the actions stay.
  it('scrolls its tabs rather than squeezing the trailing controls', () => {
    renderTabs();

    const scroller = screen.UNSAFE_getByType(ScrollView);
    expect(scroller.props.horizontal).toBe(true);
    expect(StyleSheet.flatten(scroller.props.style)).toMatchObject({
      flexGrow: 0,
      flexShrink: 1,
    });
    let trailing = screen.getByTestId('clear').parent;
    while (
      trailing &&
      !('flexShrink' in StyleSheet.flatten(trailing.props.style ?? {}))
    ) {
      trailing = trailing.parent;
    }
    expect(StyleSheet.flatten(trailing?.props.style)).toMatchObject({
      flexGrow: 1,
      flexShrink: 0,
    });
  });

  it('switches to a tab pressed, and ignores the one already shown', () => {
    const onChange = jest.fn();
    renderTabs(onChange);

    fireEvent.press(screen.getByTestId('tab-shopping'));
    fireEvent.press(screen.getByTestId('tab-purchased'));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('purchased');
  });
});
