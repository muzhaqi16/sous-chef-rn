import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ListTemplate } from '../ListTemplate';

jest.mock('../../organisms/ItemList', () => {
  const { View, Text: RNText } = require('react-native');
  return {
    ItemList: ({
      items,
      emptyState,
      testIDPrefix,
      ListHeaderComponent,
      ListFooterComponent,
    }: any) => (
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
          items.map((item: any, index: number) => (
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
    ),
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
    const CustomList = ({ items: listItems }: any) => (
      <>
        {listItems.map((item: any) => (
          <Text key={item.id}>{`custom-${item.title}`}</Text>
        ))}
      </>
    );
    render(<ListTemplate items={items} customListComponent={CustomList} />);
    expect(screen.getByText('custom-Item 1')).toBeTruthy();
    expect(screen.getByText('custom-Item 2')).toBeTruthy();
  });

  it('does not show loading empty state when custom component provided', () => {
    const CustomList = ({ emptyState }: any) => (
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
});
