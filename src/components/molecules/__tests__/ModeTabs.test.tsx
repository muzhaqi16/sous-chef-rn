import React from 'react';
import { ScrollView, type View } from 'react-native';
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

  // The List tutorial's Purchased-tab step asks for the tab's rect only once
  // the step starts, after the tab's last layout.
  it('reports a tab’s rect to a receiver that arrives after layout', () => {
    const frame = jest
      .spyOn(global, 'requestAnimationFrame')
      .mockImplementation(callback => {
        callback(0);
        return 0;
      });
    const onTabLayout = jest.fn();
    const tabs = (receiver?: typeof onTabLayout) => (
      <ModeTabs
        options={['shopping', 'purchased']}
        value="shopping"
        onChange={jest.fn()}
        formatLabel={option => option}
        onTabLayout={receiver}
      />
    );
    type MeasureCallback = Parameters<View['measure']>[0];
    render(tabs());
    // The preset's mocked View: each tab's wrapper is a class instance.
    for (const { instance } of screen.UNSAFE_getAllByProps({
      collapsable: false,
    })) {
      if (instance) {
        (instance as View).measure = (callback: MeasureCallback) =>
          callback(0, 0, 80, 40, 10, 100);
      }
    }

    screen.rerender(tabs(onTabLayout));

    expect(onTabLayout).toHaveBeenCalledWith('purchased', {
      x: 10,
      y: 100,
      width: 80,
      height: 40,
    });
    frame.mockRestore();
  });
});
