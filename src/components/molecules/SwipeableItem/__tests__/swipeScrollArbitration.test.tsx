'use no memo';
import React from 'react';
import { render } from '@testing-library/react-native';
import { SwipeableItem } from '../SwipeableItem';
import { Text } from '#components/atoms/Text';

// Capture what reaches RNGH's Swipeable. RNGH's own default is 10dp, which a thumb
// scrolling a list drifts past sideways — so the row must raise it. The sign is the
// other half: `dragOffsetFromRight` must be non-positive or ReanimatedSwipeable
// throws in __DEV__, which is why the component takes one positive `dragOffset` and
// applies the sign itself.
const swipeableProps: Record<string, unknown>[] = [];

jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ({ children, ...props }: { children: React.ReactNode }) => {
      swipeableProps.push(props as Record<string, unknown>);
      return require('react').createElement(View, null, children);
    },
  };
});

jest.mock('../RightActions', () => ({ RightActions: () => null }));
jest.mock('../LeftActions', () => ({ LeftActions: () => null }));

const renderItem = (props: Record<string, unknown> = {}) =>
  render(
    <SwipeableItem onEdit={jest.fn()} onDelete={jest.fn()} {...props}>
      <Text>Row</Text>
    </SwipeableItem>,
  );

describe('SwipeableItem scroll arbitration', () => {
  beforeEach(() => {
    swipeableProps.length = 0;
  });

  it('needs more horizontal travel than RNGH asks for by default', () => {
    renderItem();
    expect(swipeableProps[0].dragOffsetFromLeft).toBe(16);
    expect(swipeableProps[0].dragOffsetFromRight).toBe(-16);
  });

  it('lets a call site retune it, keeping the right offset non-positive', () => {
    renderItem({ dragOffset: 32 });
    expect(swipeableProps[0].dragOffsetFromLeft).toBe(32);
    expect(swipeableProps[0].dragOffsetFromRight).toBe(-32);
  });
});
