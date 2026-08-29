import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { ListTemplate } from '../ListTemplate';

type TestItem = { id: string; title?: string };
type TestEmptyState = { title: string };
type ListSlotComponent =
  | React.ComponentType<unknown>
  | React.ReactElement
  | null;

/** Captures what the template forwarded, so the wiring can be asserted. */
const mockItemListProps = jest.fn();

jest.mock('../../organisms/ItemList', () => {
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

  it('forwards onBeforeItemRemoved to the list', () => {
    // `ItemList` pairs it with `prepareForLayoutAnimationRender()` for every
    // action flagged `removesRow`. The template never forwarded it, so that
    // whole path was unreachable from a screen.
    const onBeforeItemRemoved = jest.fn();

    render(
      <ListTemplate items={items} onBeforeItemRemoved={onBeforeItemRemoved} />,
    );

    expect(mockItemListProps).toHaveBeenCalledWith(
      expect.objectContaining({ onBeforeItemRemoved }),
    );
  });

  it('does not let customListProps override the template’s own wiring', () => {
    // The spread used to come LAST, so a colliding key silently replaced the
    // wiring the template exists to guarantee.
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
        customListProps={{ onItemPress: callerHandler }}
      />,
    );

    seen[0]?.('1');
    expect(templateHandler).toHaveBeenCalledWith('1');
    expect(callerHandler).not.toHaveBeenCalled();
  });
});
