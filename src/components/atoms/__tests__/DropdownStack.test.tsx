import React from 'react';
import { Text } from '#components/atoms/Text';
import { render, screen } from '@testing-library/react-native';
import { DropdownStack } from '../DropdownStack';

/** Collect the wrapper Views the stack renders, in order. */
const getWrappers = () => {
  const tree = screen.toJSON();
  return Array.isArray(tree) ? tree : [tree];
};

describe('DropdownStack', () => {
  it('renders every child inside a wrapper with descending non-zero zIndex', () => {
    render(
      <DropdownStack>
        <Text>first</Text>
        <Text>second</Text>
        <Text>third</Text>
      </DropdownStack>,
    );

    expect(screen.getByText('first')).toBeOnTheScreen();
    expect(screen.getByText('second')).toBeOnTheScreen();
    expect(screen.getByText('third')).toBeOnTheScreen();

    const wrappers = getWrappers();
    expect(wrappers).toHaveLength(3);
    const zIndexes = wrappers.map(w => w?.props.style.zIndex);
    expect(zIndexes).toEqual([3, 2, 1]);
  });

  it('marks every wrapper collapsable={false} so Android cannot flatten it away', () => {
    render(
      <DropdownStack>
        <Text>a</Text>
        <Text>b</Text>
      </DropdownStack>,
    );

    for (const wrapper of getWrappers()) {
      expect(wrapper?.props.collapsable).toBe(false);
    }
  });

  it('skips falsy conditional children without leaving gaps in the zIndex chain', () => {
    render(
      <DropdownStack>
        <Text>visible</Text>
        {false}
        {null}
        <Text>also visible</Text>
      </DropdownStack>,
    );

    const wrappers = getWrappers();
    expect(wrappers).toHaveLength(2);
    expect(wrappers.map(w => w?.props.style.zIndex)).toEqual([2, 1]);
  });
});
