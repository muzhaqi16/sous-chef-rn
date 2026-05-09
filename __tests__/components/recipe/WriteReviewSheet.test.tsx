'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { WriteReviewSheet } from '../../../src/features/recipes/components/WriteReviewSheet';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textSecondary: '#666',
        onPrimary: '#fff',
        primary: '#007AFF',
      },
    },
  }),
  BottomSheetModal: ({ children }: any) => children,
}));
jest.mock('../../../src/components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: any) => children,
}));
jest.mock('../../../src/features/recipes/components/StarRatingInput', () => ({
  StarRatingInput: () => null,
}));

describe('WriteReviewSheet', () => {
  const defaultProps = {
    visible: false,
    existingReview: null,
    onSubmit: jest.fn(),
    onClose: jest.fn(),
    submitting: false,
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<WriteReviewSheet {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Write a Review title when no existing review', () => {
    const { getByText } = render(
      <WriteReviewSheet {...defaultProps} visible={true} />,
    );
    expect(getByText('Write a Review')).toBeTruthy();
  });

  it('shows Edit Review title when existing review provided', () => {
    const existingReview = {
      id: 'r1',
      rating: 4,
      comment: 'Nice',
      helpful: 0,
      verified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: { id: 'u1', email: 'test@test.com', profile: null },
    };
    const { getByText } = render(
      <WriteReviewSheet
        {...defaultProps}
        visible={true}
        existingReview={existingReview as any}
      />,
    );
    expect(getByText('Edit Review')).toBeTruthy();
  });

  it('shows Rating label', () => {
    const { getByText } = render(
      <WriteReviewSheet {...defaultProps} visible={true} />,
    );
    expect(getByText('Rating')).toBeTruthy();
  });

  it('shows Submit Review button text', () => {
    const { getByText } = render(
      <WriteReviewSheet {...defaultProps} visible={true} />,
    );
    expect(getByText('Submit Review')).toBeTruthy();
  });
});
