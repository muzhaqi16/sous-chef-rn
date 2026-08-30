import React from 'react';
import { View } from 'react-native';

interface DropdownStackProps {
  children: React.ReactNode;
}

/**
 * Vertical stack for form rows that may open an `InlineAutocomplete` overlay. RN
 * `zIndex` orders SIBLINGS only, so every row in the chain needs an explicit
 * descending one, and `collapsable={false}` stops Android view flattening from
 * pruning the wrapper and discarding it. Nest a second stack for nested rows.
 */
export const DropdownStack: React.FC<DropdownStackProps> = ({ children }) => {
  const items = React.Children.toArray(children);
  return (
    <>
      {items.map((child, index) => (
        <View
          key={
            React.isValidElement(child) && child.key != null ? child.key : index
          }
          collapsable={false}
          style={{ zIndex: items.length - index }}
        >
          {child}
        </View>
      ))}
    </>
  );
};
