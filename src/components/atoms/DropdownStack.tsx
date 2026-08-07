import React from 'react';
import { View } from 'react-native';

interface DropdownStackProps {
  children: React.ReactNode;
}

/**
 * Vertical stack for form content where any child may render an
 * `InlineAutocomplete` suggestion overlay.
 *
 * Wraps each child in a `View` with an explicit, non-zero, descending
 * `zIndex` and `collapsable={false}` so a child's dropdown always paints
 * above every sibling below it. Both halves are required:
 *
 * - RN `zIndex` only orders SIBLINGS. A dropdown nested inside a row can
 *   never paint above the row's later siblings unless the row itself is
 *   raised — every sibling in the overlap chain needs an explicit zIndex.
 * - `collapsable={false}` stops Android view flattening from pruning a
 *   layout-only wrapper, which silently discards its zIndex (the classic
 *   "zIndex randomly stops working on Android").
 *
 * Use for vertically stacked children only — each wrapper is a plain
 * full-width View, so rows keep their own margins/styles. Falsy conditional
 * children (`{cond && <X />}`) are skipped. Nest a second `DropdownStack`
 * when a child has internal rows of its own (see `UnitEntryList`).
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
