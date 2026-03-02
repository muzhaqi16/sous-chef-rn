import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { PaginationFooter } from '../PaginationFooter';

describe('PaginationFooter', () => {
  it('shows loading text when isLoadingMore is true', () => {
    render(
      <PaginationFooter
        isLoadingMore={true}
        hasMore={true}
        loading={false}
        itemCount={10}
      />,
    );
    expect(screen.getByText('Loading more items...')).toBeTruthy();
  });

  it('shows custom loading text', () => {
    render(
      <PaginationFooter
        isLoadingMore={true}
        hasMore={true}
        loading={false}
        itemCount={10}
        loadingText="Fetching recipes..."
      />,
    );
    expect(screen.getByText('Fetching recipes...')).toBeTruthy();
  });

  it('shows hint text when hasMore is true and not loading', () => {
    render(
      <PaginationFooter
        isLoadingMore={false}
        hasMore={true}
        loading={false}
        itemCount={10}
      />,
    );
    expect(screen.getByText('Scroll to load more')).toBeTruthy();
  });

  it('shows custom hint text', () => {
    render(
      <PaginationFooter
        isLoadingMore={false}
        hasMore={true}
        loading={false}
        itemCount={10}
        hintText="Pull to load more"
      />,
    );
    expect(screen.getByText('Pull to load more')).toBeTruthy();
  });

  it('renders nothing when no more items', () => {
    const { toJSON } = render(
      <PaginationFooter
        isLoadingMore={false}
        hasMore={false}
        loading={false}
        itemCount={10}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing during initial loading', () => {
    const { toJSON } = render(
      <PaginationFooter
        isLoadingMore={false}
        hasMore={true}
        loading={true}
        itemCount={0}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when hasMore but no items', () => {
    const { toJSON } = render(
      <PaginationFooter
        isLoadingMore={false}
        hasMore={true}
        loading={false}
        itemCount={0}
      />,
    );
    expect(toJSON()).toBeNull();
  });
});
