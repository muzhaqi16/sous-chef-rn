'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import type { Theme } from '#/theme/themes';
import { BaseItemCard } from '#features/pantry/components/BaseItemCard/BaseItemCard';

type StyleSheetInput =
  | Record<string, unknown>
  | ((theme: Theme) => Record<string, unknown>);

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#components/organisms/SwipeableItem/SwipeableItem', () => ({
  SwipeableItem: ({ children }: { children: React.ReactNode }) => children,
}));

// Unistyles v2 useVariants is a method on the stylesheet - we need to add it
jest.mock('react-native-unistyles', () => {
  const { lightTheme } = require('#/theme/themes');
  return {
    StyleSheet: {
      create: (styleFnOrObj: StyleSheetInput) => {
        const result =
          typeof styleFnOrObj === 'function'
            ? styleFnOrObj(lightTheme)
            : styleFnOrObj;
        result.useVariants = jest.fn();
        return result;
      },
      configure: jest.fn(),
    },
    useUnistyles: jest.fn(() => ({
      theme: lightTheme,
      styles: {},
    })),
    useStyles: jest.fn((stylesheet: StyleSheetInput) => ({
      styles:
        typeof stylesheet === 'function'
          ? stylesheet(lightTheme)
          : stylesheet || {},
      theme: lightTheme,
    })),
    useInitialTheme: jest.fn(),
    withUnistyles: jest.fn(<C,>(component: C): C => component),
    UnistylesRuntime: {
      setTheme: jest.fn(),
      getTheme: jest.fn(() => lightTheme),
      colorScheme: 'light',
      themeName: 'light',
    },
  };
});

describe('BaseItemCard', () => {
  it('renders without crashing', () => {
    const { toJSON } = render(<BaseItemCard />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders children content', () => {
    const { getByText } = render(
      <BaseItemCard>
        <Text>Item Content</Text>
      </BaseItemCard>,
    );
    expect(getByText('Item Content')).toBeTruthy();
  });

  it('renders left and right elements', () => {
    const { getByText } = render(
      <BaseItemCard
        leftElement={<Text>Left</Text>}
        rightElement={<Text>Right</Text>}
      >
        <Text>Content</Text>
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
      <BaseItemCard onPress={onPress}>
        <Text>Pressable</Text>
      </BaseItemCard>,
    );
    await user.press(getByText('Pressable'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('uses SwipeableItem when swipe actions provided', () => {
    const { getByText } = render(
      <BaseItemCard
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
        <Text>Swipeable</Text>
      </BaseItemCard>,
    );
    expect(getByText('Swipeable')).toBeTruthy();
  });
});
