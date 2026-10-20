import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import { ActionTrayScrollContext } from '#components/templates/ActionTray/ActionTrayScrollContext';
import { SelectorContent } from '../SelectorContent';
import type { SelectorConfig, SelectorPagination } from '../types';

type Row = { id: string; name: string };

const config = (pagination?: SelectorPagination): SelectorConfig<Row> => ({
  title: 'Pick one',
  data: [
    { id: 'a', name: 'First' },
    { id: 'b', name: 'Second' },
  ],
  onSelect: jest.fn(),
  displayProperty: 'name',
  actions: [],
  pagination,
});

const pagination = (
  overrides: Partial<SelectorPagination> = {},
): SelectorPagination => ({
  hasMore: true,
  loadingMore: false,
  onLoadMore: jest.fn(),
  loadMoreLabel: 'Show more',
  ...overrides,
});

describe('SelectorContent pagination', () => {
  it('offers no load-more row without a next page', () => {
    render(<SelectorContent config={config(pagination({ hasMore: false }))} />);
    expect(screen.getByText('Second')).toBeTruthy();
    expect(screen.queryByText('Show more')).toBeNull();
  });

  it('fetches the next page from the trailing row', async () => {
    const user = userEvent.setup();
    const onLoadMore = jest.fn();
    render(<SelectorContent config={config(pagination({ onLoadMore }))} />);

    await user.press(screen.getByText('Show more'));
    expect(onLoadMore).toHaveBeenCalledTimes(1);
  });

  it('replaces the row with a spinner while a page is in flight', () => {
    render(
      <SelectorContent config={config(pagination({ loadingMore: true }))} />,
    );
    expect(screen.queryByText('Show more')).toBeNull();
  });

  it('keeps the row under an empty page, since a later page may match', () => {
    render(
      <SelectorContent
        config={{ ...config(pagination()), data: [], emptyMessage: 'None' }}
      />,
    );
    expect(screen.getByText('None')).toBeTruthy();
    expect(screen.getByText('Show more')).toBeTruthy();
  });
});

describe('SelectorContent on open', () => {
  const scrollToContentOffset = jest.fn();

  beforeEach(() => scrollToContentOffset.mockClear());

  /** In a settled tray 300 tall, with the second row selected. */
  const renderOpen = (overrides: Partial<SelectorConfig<Row>> = {}) =>
    render(
      <ActionTrayScrollContext.Provider
        value={{ scrollToContentOffset, viewportHeight: 300, isReady: true }}
      >
        <SelectorContent
          config={{ ...config(), selectedId: 'b', ...overrides }}
        />
      </ActionTrayScrollContext.Provider>,
    );

  const layout = (text: string, y: number, height: number) =>
    fireEvent(screen.getByText(text), 'layout', {
      nativeEvent: { layout: { x: 0, y, width: 300, height } },
    });

  it('centres the selected row', () => {
    renderOpen();
    layout('Second', 600, 50);

    expect(scrollToContentOffset).toHaveBeenCalledWith(475, true);
  });

  it('shows a leading header instead, though it arrives after the centring', () => {
    renderOpen({ listHeader: <Text>Invites</Text>, listHeaderLeads: true });
    layout('Second', 600, 50);
    layout('Invites', 0, 80);

    expect(scrollToContentOffset).toHaveBeenLastCalledWith(0, true);
  });

  it('centres past a header that leads nothing', () => {
    renderOpen({ listHeader: <Text>Filters</Text> });
    layout('Second', 600, 50);

    expect(scrollToContentOffset).toHaveBeenCalledWith(475, true);
  });
});
