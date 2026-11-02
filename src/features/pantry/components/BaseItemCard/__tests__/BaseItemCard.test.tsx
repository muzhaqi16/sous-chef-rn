'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { CardContent } from '#features/pantry/components/BaseItemCard/CardContent';
import { CardRightSlot } from '#features/pantry/components/BaseItemCard/CardRightSlot';
import { BaseItemCard } from '#features/pantry/components/BaseItemCard/BaseItemCard';

jest.mock('#components/organisms/SwipeableItem/SwipeableItem', () => ({
  SwipeableItem: ({ children }: { children: React.ReactNode }) => children,
}));

describe('BaseItemCard', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<BaseItemCard accessibilityLabel="Row" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders children content', () => {
    const { getByText } = render(
      <BaseItemCard accessibilityLabel="Row">
        <Text role="body">Item Content</Text>
      </BaseItemCard>,
    );
    expect(getByText('Item Content')).toBeTruthy();
  });

  it('renders left and right elements', () => {
    const { getByText } = render(
      <BaseItemCard
        accessibilityLabel="Row"
        leftElement={<Text role="body">Left</Text>}
        rightElement={<Text role="body">Right</Text>}
      >
        <Text role="body">Content</Text>
      </BaseItemCard>,
    );
    expect(getByText('Left')).toBeTruthy();
    expect(getByText('Right')).toBeTruthy();
    expect(getByText('Content')).toBeTruthy();
  });

  it('wraps in Pressable when onPress provided without swipe actions', async () => {
    const user = userEvent.setup();
    const onPress = jest.fn();
    const { getByText } = render(
      <BaseItemCard accessibilityLabel="Row" onPress={onPress}>
        <Text role="body">Pressable</Text>
      </BaseItemCard>,
    );
    await user.press(getByText('Pressable'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  // The row centres its slots, text columns included: pinned to the top, a
  // one-line row sat over an empty band, and the trailing meta sits level with
  // the text beside it, as a list's trailing detail does.
  it('centres the title and the meta in the row, subtitle or not', () => {
    type Node = ReturnType<ReturnType<typeof render>['getByText']>;
    // The nearest host View above a text: the column it sits in.
    const columnOf = (text: Node) => {
      let node = text.parent;
      while (node && typeof node.type !== 'string') node = node.parent;
      return node;
    };
    const { getByText } = render(
      <BaseItemCard
        accessibilityLabel="Row"
        rightElement={<CardRightSlot primary="1 g" />}
      >
        <CardContent title="Feta Cheese" />
      </BaseItemCard>,
    );

    expect(columnOf(getByText('Feta Cheese'))).not.toHaveStyle({
      alignSelf: 'stretch',
    });
    expect(columnOf(getByText('1 g'))).not.toHaveStyle({
      alignSelf: 'stretch',
    });
  });

  it('uses SwipeableItem when swipe actions provided', () => {
    const { getByText } = render(
      <BaseItemCard
        accessibilityLabel="Row"
        rightActions={[
          {
            key: 'edit',
            icon: 'create-outline',
            labelKey: 'labels.edit',
            onPress: jest.fn(),
          },
          {
            key: 'delete',
            icon: 'trash-outline',
            labelKey: 'labels.delete',
            onPress: jest.fn(),
          },
        ]}
      >
        <Text role="body">Swipeable</Text>
      </BaseItemCard>,
    );
    expect(getByText('Swipeable')).toBeTruthy();
  });
});
