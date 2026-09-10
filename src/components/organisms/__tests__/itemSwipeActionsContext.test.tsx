/**
 * A list that supplies no swipe actions must not erase the ones the screen did.
 *
 * `SortableList` and `ItemList` each render an `ItemSwipeActionsProvider` for
 * their own optional prop, and both sit INSIDE the provider the screen renders.
 * With a plain context provider, the inner one publishes `undefined` and shadows
 * the outer — so every shopping-list row lost swipe-to-edit and swipe-to-delete
 * while every layer type-checked, because each prop along the way is optional.
 *
 * Deliberately does NOT mock the context: substituting the transport is what
 * makes a wiring test assert that a component uses a value it was handed, which
 * was never in doubt. `SortableItem.test.tsx` mocks `useItemSwipeActions`
 * wholesale, which is why the defect was invisible there.
 */
import { render, screen } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import {
  ItemSwipeActionsProvider,
  useItemSwipeActions,
} from '../itemSwipeActionsContext';
import type { ItemSwipeActionsFactory } from '#components/organisms/SwipeableItem/types';

const Probe = () => {
  const factory = useItemSwipeActions();
  const built = factory?.('row-1');
  return <Text>{built?.right?.[0]?.key ?? 'none'}</Text>;
};

const factory: ItemSwipeActionsFactory = id => ({
  right: [
    {
      key: 'delete',
      icon: 'trash-outline',
      labelKey: 'labels.delete',
      onPress: () => undefined,
    },
  ],
  left: [
    {
      key: `edit-${id}`,
      icon: 'pencil-outline',
      labelKey: 'labels.edit',
      onPress: () => undefined,
    },
  ],
});

describe('ItemSwipeActionsProvider', () => {
  it('delivers the screen’s factory to a row', () => {
    render(
      <ItemSwipeActionsProvider value={factory}>
        <Probe />
      </ItemSwipeActionsProvider>,
    );

    expect(screen.getByText('delete')).toBeTruthy();
  });

  it('does not shadow an outer factory when the inner list supplies none', () => {
    render(
      <ItemSwipeActionsProvider value={factory}>
        <ItemSwipeActionsProvider value={undefined}>
          <Probe />
        </ItemSwipeActionsProvider>
      </ItemSwipeActionsProvider>,
    );

    expect(screen.getByText('delete')).toBeTruthy();
  });

  it('lets an inner list override with its own factory', () => {
    const inner: ItemSwipeActionsFactory = () => ({
      right: [
        {
          key: 'archive',
          icon: 'archive-outline',
          labelKey: 'labels.delete',
          onPress: () => undefined,
        },
      ],
    });

    render(
      <ItemSwipeActionsProvider value={factory}>
        <ItemSwipeActionsProvider value={inner}>
          <Probe />
        </ItemSwipeActionsProvider>
      </ItemSwipeActionsProvider>,
    );

    expect(screen.getByText('archive')).toBeTruthy();
  });

  it('is undefined with no provider at all', () => {
    render(<Probe />);

    expect(screen.getByText('none')).toBeTruthy();
  });
});
