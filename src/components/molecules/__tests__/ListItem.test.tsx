import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { IconButton } from '#components/atoms/IconButton';
import type { SwipeRowPress } from '#components/molecules/RowFrame';

import { ListItem } from '../ListItem';

const swipePress = (overrides: Partial<SwipeRowPress> = {}): SwipeRowPress => ({
  onPress: jest.fn(),
  accessibilityLabel: 'Milk',
  accessibilityHint: 'Swipe for actions',
  accessibilityActions: [],
  onAccessibilityAction: jest.fn(),
  ...overrides,
});

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

  // A control inside the row's press is swallowed by it, for a tap and for a
  // screen reader: it sits beside the press, its own element.
  describe('a control in the row', () => {
    it("fires its own action, not the row's", async () => {
      const onPress = jest.fn();
      const onDismiss = jest.fn();
      render(
        <ListItem
          title="Milk"
          onPress={onPress}
          trailingActions={
            <IconButton
              name="close"
              onPress={onDismiss}
              accessibilityLabel="Dismiss"
            />
          }
        />,
      );

      await userEvent.setup().press(screen.getByLabelText('Dismiss'));

      expect(onDismiss).toHaveBeenCalledTimes(1);
      expect(onPress).not.toHaveBeenCalled();
    });

    it('is reached apart from the row', () => {
      render(
        <ListItem
          title="Milk"
          onPress={jest.fn()}
          trailingActions={
            <IconButton
              name="close"
              onPress={jest.fn()}
              accessibilityLabel="Dismiss"
            />
          }
        />,
      );

      const row = screen.getByLabelText('Milk');
      const control = screen.getByLabelText('Dismiss');
      expect(row).not.toContainElement(control);
    });

    it("takes a swipe row's press on the row, with the control beside it", () => {
      const press = swipePress();
      render(
        <ListItem
          title="Milk"
          swipe={press}
          trailingActions={
            <IconButton
              name="archive-outline"
              onPress={jest.fn()}
              accessibilityLabel="Move to pantry"
            />
          }
        />,
      );

      const row = screen.getByLabelText('Milk');
      expect(row.props.accessibilityActions).toBe(press.accessibilityActions);
      expect(row.props.accessibilityHint).toBe('Swipe for actions');
      expect(row).not.toContainElement(screen.getByLabelText('Move to pantry'));
    });
  });
});
