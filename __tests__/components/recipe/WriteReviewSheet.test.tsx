'use no memo';

import React from 'react';
import { WriteReviewSheet } from '../../../src/features/recipes/components/WriteReviewSheet';
import {
  renderWithApollo,
  seedCache,
} from '../../helpers/apolloMockProvider';

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
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../src/components/atoms/BottomSheetFormScrollView', () => ({
  BottomSheetFormScrollView: ({ children }: { children: React.ReactNode }) =>
    children,
}));
jest.mock('../../../src/features/recipes/components/StarRatingInput', () => ({
  StarRatingInput: () => null,
}));

const REVIEW_ID = 'r1';

function makeCache() {
  return seedCache([
    {
      __typename: 'RecipeReview',
      id: REVIEW_ID,
      rating: 4,
      comment: 'Nice',
    },
  ]);
}

describe('WriteReviewSheet', () => {
  const defaultProps = {
    visible: false,
    existingReviewId: null,
    onSubmit: jest.fn(),
    onClose: jest.fn(),
    submitting: false,
  };

  it('renders without crashing', () => {
    const { toJSON } = renderWithApollo(
      <WriteReviewSheet {...defaultProps} />,
    );
    expect(toJSON()).toBeTruthy();
  });

  it('shows Write a Review title when no existing review', () => {
    const { getByText } = renderWithApollo(
      <WriteReviewSheet {...defaultProps} visible={true} />,
    );
    expect(getByText('Write a Review')).toBeTruthy();
  });

  it('shows Edit Review title when existing review provided', () => {
    const { getByText } = renderWithApollo(
      <WriteReviewSheet
        {...defaultProps}
        visible={true}
        existingReviewId={REVIEW_ID}
      />,
      { cache: makeCache() },
    );
    expect(getByText('Edit Review')).toBeTruthy();
  });

  it('shows Rating label', () => {
    const { getByText } = renderWithApollo(
      <WriteReviewSheet {...defaultProps} visible={true} />,
    );
    expect(getByText('Rating')).toBeTruthy();
  });

  it('shows Submit Review button text', () => {
    const { getByText } = renderWithApollo(
      <WriteReviewSheet {...defaultProps} visible={true} />,
    );
    expect(getByText('Submit Review')).toBeTruthy();
  });
});
