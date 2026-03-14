import React from 'react';
import { ActivityIndicator } from 'react-native';
import { render } from '@testing-library/react-native';
import { PaginationFooter } from '../PaginationFooter';

describe('PaginationFooter', () => {
  it('shows spinner when hasMore is true', () => {
    const { UNSAFE_getByType } = render(
      <PaginationFooter hasMore={true} itemCount={10} />,
    );
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });

  it('renders nothing when no more items', () => {
    const { toJSON } = render(
      <PaginationFooter hasMore={false} itemCount={10} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders nothing when hasMore but no items yet', () => {
    const { toJSON } = render(
      <PaginationFooter hasMore={true} itemCount={0} />,
    );
    expect(toJSON()).toBeNull();
  });
});
