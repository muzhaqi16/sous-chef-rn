import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { ListTemplate } from '#features/shoppingList/components/ListTemplate';
import {
  ItemSwipeActionsProvider,
  useItemSwipeActions,
} from '#components/organisms/itemSwipeActionsContext';

type TestItem = { id: string; title?: string };
type TestEmptyState = { title: string };
type ListSlotComponent =
  | React.ComponentType<unknown>
  | React.ReactElement
  | null;

/** Captures what the template forwarded, so the wiring can be asserted. */
const mockItemListProps = jest.fn();

jest.mock('#components/organisms/ItemList', () => {
  const { View, Text: RNText } = require('react-native');
  return {
    ItemList: ({
      items,
      emptyState,
      testIDPrefix,
      ListHeaderComponent,
      ListFooterComponent,
      ...rest
    }: {
      items: TestItem[];
      emptyState?: TestEmptyState;
      testIDPrefix?: string;
      ListHeaderComponent?: ListSlotComponent;
      ListFooterComponent?: ListSlotComponent;
      [key: string]: unknown;
    }) => {
      mockItemListProps(rest);
      return (
        <View testID="item-list">
          {ListHeaderComponent ? (
            typeof ListHeaderComponent === 'function' ? (
              <ListHeaderComponent />
            ) : (
              ListHeaderComponent
            )
          ) : null}
          {items.length === 0 && emptyState ? (
            <RNText testID="empty-state">{emptyState.title}</RNText>
          ) : (
            items.map((item, index: number) => (
              <RNText
                key={item.id}
                testID={testIDPrefix ? `${testIDPrefix}-${index}` : undefined}
              >
                {item.title || item.id}
              </RNText>
            ))
          )}
          {ListFooterComponent ? (
            typeof ListFooterComponent === 'function' ? (
              <ListFooterComponent />
            ) : (
              ListFooterComponent
            )
          ) : null}
        </View>
      );
    },
  };
});

describe('ListTemplate', () => {
  const items = [
    { id: '1', title: 'Item 1' },
    { id: '2', title: 'Item 2' },
  ];

  it('renders items using default ItemList', () => {
    render(<ListTemplate items={items} />);
    expect(screen.getByTestId('item-list')).toBeTruthy();
    expect(screen.getByText('Item 1')).toBeTruthy();
    expect(screen.getByText('Item 2')).toBeTruthy();
  });

  it('renders empty state when loading with no items', () => {
    render(
      <ListTemplate
        items={[]}
        loading={true}
        emptyState={{
          title: 'Pantry Items',
          icon: 'cube-outline',
          loadingDescription: 'Loading pantry',
        }}
      />,
    );
    // Loading state shows "Loading..." title
    expect(screen.getByText('Loading...')).toBeTruthy();
  });

  it('renders custom empty state when not loading', () => {
    render(
      <ListTemplate
        items={[]}
        loading={false}
        emptyState={{ title: 'No pantry items', icon: 'cube-outline' }}
      />,
    );
    expect(screen.getByText('No pantry items')).toBeTruthy();
  });

  it('renders with testIDPrefix', () => {
    render(<ListTemplate items={items} testIDPrefix="pantry" />);
    expect(screen.getByTestId('pantry-0')).toBeTruthy();
    expect(screen.getByTestId('pantry-1')).toBeTruthy();
  });

  it('renders custom list component when provided', () => {
    const CustomList = ({ items: listItems }: { items: TestItem[] }) => (
      <>
        {listItems.map(item => (
          <Text key={item.id}>{`custom-${item.title}`}</Text>
        ))}
      </>
    );
    render(<ListTemplate items={items} customListComponent={CustomList} />);
    expect(screen.getByText('custom-Item 1')).toBeTruthy();
    expect(screen.getByText('custom-Item 2')).toBeTruthy();
  });

  it('does not show loading empty state when custom component provided', () => {
    const CustomList = ({ emptyState }: { emptyState?: TestEmptyState }) => (
      <Text>{emptyState?.title || 'custom'}</Text>
    );
    render(
      <ListTemplate
        items={[]}
        loading={true}
        customListComponent={CustomList}
        emptyState={{
          title: 'No items',
          icon: 'cube-outline',
          loadingDescription: 'Loading...',
        }}
      />,
    );
    // Custom component handles its own loading, so emptyState passes through as-is
    expect(screen.getByText('No items')).toBeTruthy();
  });

  it('renders ListHeaderComponent', () => {
    render(
      <ListTemplate items={items} ListHeaderComponent={<Text>Header</Text>} />,
    );
    expect(screen.getByText('Header')).toBeTruthy();
  });

  it('does not let customListProps override the template’s own wiring', () => {
    // The spread must not come LAST: a colliding key would silently replace
    // the wiring the template exists to guarantee.
    const templateHandler = jest.fn();
    const callerHandler = jest.fn();
    const seen: Array<(id: string) => void> = [];
    const CustomList = ({
      onItemPress,
    }: {
      onItemPress: (id: string) => void;
    }) => {
      seen.push(onItemPress);
      return <Text>custom</Text>;
    };

    render(
      <ListTemplate
        items={items}
        onItemPress={templateHandler}
        customListComponent={CustomList}
        // The type refuses a colliding key now; this asserts the RUNTIME
        // backstop still holds if one ever gets through (a cast, a spread of a
        // wider object).
        // @ts-expect-error deliberate collision — the guard must reject it
        customListProps={{ onItemPress: callerHandler }}
      />,
    );

    seen[0]?.('1');
    expect(templateHandler).toHaveBeenCalledWith('1');
    expect(callerHandler).not.toHaveBeenCalled();
  });
  /**
   * The supplier-to-consumer hop, rendered rather than asserted on props.
   *
   * The screen supplies the factory, the template injects it into whatever list
   * it was given, and the row reads it from context. Every prop along that path
   * is optional, so a layer that stops forwarding type-checks — which is how
   * every shopping-list row lost its swipe actions under a green suite. This
   * renders the real template into a custom list component that CONSUMES the
   * context, so a break anywhere between the two fails here.
   */
  it('delivers the supplied swipe actions to a custom list that reads context', () => {
    // Mirrors the production shape: the template injects the factory as a PROP,
    // the custom list publishes it, and the row reads it from context.
    const Row = () => {
      const factory = useItemSwipeActions();
      const built = factory?.('row-1');
      return <Text>{built?.left?.[0]?.key ?? 'no-actions'}</Text>;
    };
    const Consumer = ({
      itemSwipeActions,
    }: {
      itemSwipeActions?: Parameters<
        typeof ItemSwipeActionsProvider
      >[0]['value'];
    }) => (
      <ItemSwipeActionsProvider value={itemSwipeActions}>
        <Row />
      </ItemSwipeActionsProvider>
    );

    render(
      <ListTemplate
        items={items}
        customListComponent={Consumer}
        itemSwipeActions={id => ({
          left: [
            {
              key: `edit-${id}`,
              icon: 'pencil-outline',
              labelKey: 'labels.edit',
              onPress: () => undefined,
            },
          ],
        })}
      />,
    );

    expect(screen.getByText('edit-row-1')).toBeTruthy();
  });

  it('withholds the actions from the default list while it is loading', () => {
    render(<ListTemplate items={[]} loading itemSwipeActions={() => ({})} />);

    // A row cannot act on a list that has not loaded. This applies to the
    // DEFAULT list only: `isLoading` is false whenever a custom list component
    // is present, because that component owns its own loading state.
    expect(mockItemListProps).toHaveBeenCalledWith(
      expect.objectContaining({ itemSwipeActions: undefined }),
    );
  });

  it('does not withhold them from a custom list, which owns its loading', () => {
    const seen: Array<unknown> = [];
    const Consumer = ({ itemSwipeActions }: { itemSwipeActions?: unknown }) => {
      seen.push(itemSwipeActions);
      return <Text>custom</Text>;
    };

    render(
      <ListTemplate
        items={[]}
        loading
        customListComponent={Consumer}
        itemSwipeActions={() => ({})}
      />,
    );

    expect(seen[0]).toEqual(expect.any(Function));
  });
});
