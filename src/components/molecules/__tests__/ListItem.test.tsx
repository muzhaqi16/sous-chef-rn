import React from 'react';
import { Text } from 'react-native';
import { render, screen, userEvent } from '@testing-library/react-native';

// Override the global unistyles mock to add useVariants (needed by ListItem's style variants)
jest.mock('react-native-unistyles', () => {
  const { lightTheme } = require('../../../theme/themes');
  return {
    StyleSheet: {
      create: (styleFnOrObj: any) => {
        const result =
          typeof styleFnOrObj === 'function'
            ? styleFnOrObj(lightTheme)
            : styleFnOrObj;
        result.useVariants = jest.fn();
        return result;
      },
      configure: jest.fn(),
    },
    useUnistyles: jest.fn(() => ({ theme: lightTheme, styles: {} })),
    useStyles: jest.fn((stylesheet: any) => ({
      styles:
        typeof stylesheet === 'function'
          ? stylesheet(lightTheme)
          : stylesheet || {},
      theme: lightTheme,
    })),
    useInitialTheme: jest.fn(),
    withUnistyles: jest.fn((component: any) => component),
    UnistylesRuntime: {
      setTheme: jest.fn(),
      getTheme: jest.fn(() => lightTheme),
      colorScheme: 'light',
      themeName: 'light',
      contentSizeCategory: 'Medium',
      breakpoint: undefined,
      orientation: 'portrait',
      pixelRatio: 2,
      fontScale: 1,
      screen: { width: 390, height: 844 },
      insets: { top: 0, bottom: 0, left: 0, right: 0 },
      statusBar: { width: 390, height: 44 },
      navigationBar: { width: 390, height: 0 },
    },
  };
});

import { ListItem } from '../ListItem';

describe('ListItem', () => {
  it('renders title text', () => {
    render(<ListItem title="Milk" />);
    expect(screen.getByText('Milk')).toBeTruthy();
  });

  it('renders subtitle when provided as string', () => {
    render(<ListItem title="Milk" subtitle="1 gallon" />);
    expect(screen.getByText('1 gallon')).toBeTruthy();
  });

  it('renders subtitle when provided as ReactNode', () => {
    render(<ListItem title="Milk" subtitle={<Text>Custom subtitle</Text>} />);
    expect(screen.getByText('Custom subtitle')).toBeTruthy();
  });

  it('does not render subtitle when not provided', () => {
    render(<ListItem title="Milk" />);
    expect(screen.queryByText('1 gallon')).toBeNull();
  });

  it('renders children directly when provided', () => {
    render(
      <ListItem>
        <Text>Custom content</Text>
      </ListItem>,
    );
    expect(screen.getByText('Custom content')).toBeTruthy();
  });

  it('renders as pressable with button role when onPress is provided', () => {
    const onPress = jest.fn();
    render(<ListItem title="Milk" onPress={onPress} />);
    const button = screen.getByRole('button');
    expect(button).toBeTruthy();
  });

  it('calls onPress when pressed', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    render(<ListItem title="Milk" onPress={onPress} />);
    await user.press(screen.getByRole('button'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('has proper accessibility label', () => {
    const onPress = jest.fn();
    render(<ListItem title="Milk" subtitle="2 liters" onPress={onPress} />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityLabel).toContain('Milk');
    expect(button.props.accessibilityLabel).toContain('2 liters');
  });

  it('renders badge when provided', () => {
    render(
      <ListItem title="Item" badge={{ text: 'New', variant: 'primary' }} />,
    );
    expect(screen.getByText('New')).toBeTruthy();
  });

  it('renders rightElement when provided', () => {
    render(<ListItem title="Item" rightElement={<Text>Right</Text>} />);
    expect(screen.getByText('Right')).toBeTruthy();
  });

  it('renders leftElement when provided', () => {
    render(<ListItem title="Item" leftElement={<Text>Left</Text>} />);
    expect(screen.getByText('Left')).toBeTruthy();
  });

  it('sets disabled accessibility state when isPurchased', () => {
    const onPress = jest.fn();
    render(<ListItem title="Milk" onPress={onPress} isPurchased />);
    const button = screen.getByRole('button');
    expect(button.props.accessibilityState).toEqual(
      expect.objectContaining({ disabled: true }),
    );
  });
});
