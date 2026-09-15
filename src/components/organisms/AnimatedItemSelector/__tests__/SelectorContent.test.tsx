import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SelectorContent } from '../SelectorContent';
import type { SelectorConfig, SelectorPagination } from '../types';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

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
