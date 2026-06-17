import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { render } from '@testing-library/react-native';
import { PaginationFooter } from '../PaginationFooter';
import { Text } from '#components/atoms/Text';

const MockSkeleton: React.FC<{ animated?: boolean }> = ({ animated }) => (
  <View testID="skeleton-item">
    <Text>{animated ? 'animated' : 'static'}</Text>
  </View>
);

describe('PaginationFooter', () => {
  describe('spinner fallback (no SkeletonComponent)', () => {
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

  describe('skeleton placeholders', () => {
    it('renders skeleton components when SkeletonComponent is provided', () => {
      const { getAllByTestId } = render(
        <PaginationFooter
          hasMore={true}
          itemCount={10}
          SkeletonComponent={MockSkeleton}
        />,
      );
      expect(getAllByTestId('skeleton-item')).toHaveLength(3);
    });

    it('renders custom skeletonCount', () => {
      const { getAllByTestId } = render(
        <PaginationFooter
          hasMore={true}
          itemCount={10}
          SkeletonComponent={MockSkeleton}
          skeletonCount={5}
        />,
      );
      expect(getAllByTestId('skeleton-item')).toHaveLength(5);
    });

    it('renders nothing when hasMore is false even with SkeletonComponent', () => {
      const { toJSON } = render(
        <PaginationFooter
          hasMore={false}
          itemCount={10}
          SkeletonComponent={MockSkeleton}
        />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders nothing when itemCount is 0 even with SkeletonComponent', () => {
      const { toJSON } = render(
        <PaginationFooter
          hasMore={true}
          itemCount={0}
          SkeletonComponent={MockSkeleton}
        />,
      );
      expect(toJSON()).toBeNull();
    });

    it('does not render spinner when SkeletonComponent is provided', () => {
      const { UNSAFE_queryByType } = render(
        <PaginationFooter
          hasMore={true}
          itemCount={10}
          SkeletonComponent={MockSkeleton}
        />,
      );
      expect(UNSAFE_queryByType(ActivityIndicator)).toBeNull();
    });
  });

  describe('isFetchingMore gating', () => {
    it('renders nothing when more pages exist but no fetch is in flight', () => {
      const { toJSON } = render(
        <PaginationFooter
          hasMore={true}
          isFetchingMore={false}
          itemCount={10}
          SkeletonComponent={MockSkeleton}
        />,
      );
      expect(toJSON()).toBeNull();
    });

    it('renders skeletons only while a fetch is in flight', () => {
      const { getAllByTestId } = render(
        <PaginationFooter
          hasMore={true}
          isFetchingMore={true}
          itemCount={10}
          SkeletonComponent={MockSkeleton}
        />,
      );
      expect(getAllByTestId('skeleton-item')).toHaveLength(3);
    });

    it('isFetchingMore overrides hasMore=false for the indicator', () => {
      const { UNSAFE_getByType } = render(
        <PaginationFooter
          hasMore={false}
          isFetchingMore={true}
          itemCount={10}
        />,
      );
      expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    });
  });
});
