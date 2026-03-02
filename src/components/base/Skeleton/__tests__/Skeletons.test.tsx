import React from 'react';
import { render } from '@testing-library/react-native';
import { SkeletonBase } from '../SkeletonBase';
import { SkeletonCircle } from '../SkeletonCircle';
import { SkeletonLine } from '../SkeletonLine';
import { SkeletonRectangle } from '../SkeletonRectangle';
import { SkeletonListItem } from '../SkeletonListItem';
import { SkeletonList } from '../SkeletonList';

describe('Skeleton smoke tests', () => {
  describe('SkeletonBase', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<SkeletonBase />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with custom dimensions', () => {
      const { toJSON } = render(<SkeletonBase width={200} height={40} borderRadius={8} />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders without animation', () => {
      const { toJSON } = render(<SkeletonBase animated={false} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('SkeletonCircle', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<SkeletonCircle />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with custom size', () => {
      const { toJSON } = render(<SkeletonCircle size={60} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('SkeletonLine', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<SkeletonLine />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with custom width', () => {
      const { toJSON } = render(<SkeletonLine width="50%" height={24} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('SkeletonRectangle', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<SkeletonRectangle />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with custom dimensions', () => {
      const { toJSON } = render(<SkeletonRectangle width={300} height={200} borderRadius={12} />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('SkeletonListItem', () => {
    it('renders without crashing', () => {
      const { toJSON } = render(<SkeletonListItem />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with circle leading type', () => {
      const { toJSON } = render(<SkeletonListItem showLeading leadingType="circle" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with rectangle leading type', () => {
      const { toJSON } = render(<SkeletonListItem showLeading leadingType="rectangle" />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders without leading element', () => {
      const { toJSON } = render(<SkeletonListItem showLeading={false} />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders with trailing element', () => {
      const { toJSON } = render(<SkeletonListItem showTrailing />);
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('SkeletonList', () => {
    it('renders without crashing', () => {
      const MockSkeleton = () => <SkeletonLine />;
      const { toJSON } = render(<SkeletonList SkeletonComponent={MockSkeleton} />);
      expect(toJSON()).toBeTruthy();
    });

    it('renders specified count of items', () => {
      const MockSkeleton = () => <SkeletonLine />;
      const { toJSON } = render(<SkeletonList SkeletonComponent={MockSkeleton} count={3} />);
      expect(toJSON()).toBeTruthy();
    });
  });
});
