'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { ReviewSection } from '../../../src/features/recipes/components/ReviewSection';
import type { RecipeReviewFragment } from '../../../src/features/recipes/graphql/recipeFragments.generated';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/features/recipes/components/RatingBreakdown', () => ({
  RatingBreakdown: () => 'RatingBreakdown',
}));
jest.mock('../../../src/features/recipes/components/ReviewCard', () => ({
  ReviewCard: () => 'ReviewCard',
}));
jest.mock('../../../src/features/recipes/components/WriteReviewSheet', () => ({
  WriteReviewSheet: () => null,
}));

const defaultProps = {
  reviews: [],
  totalReviews: 0,
  averageRating: 0,
  rating1Count: 0,
  rating2Count: 0,
  rating3Count: 0,
  rating4Count: 0,
  rating5Count: 0,
  userReview: null,
  hasReviewed: false,
  isOwnRecipe: false,
  createReview: jest.fn(),
  updateReview: jest.fn(),
  deleteReview: jest.fn(),
  toggleHelpful: jest.fn(),
  hasVotedHelpful: jest.fn(() => false),
  submitting: false,
};

describe('ReviewSection', () => {
  it('renders without crashing', () => {
    const { getByText } = render(<ReviewSection {...defaultProps} />);
    expect(getByText('Reviews')).toBeTruthy();
  });

  it('returns null when isOwnRecipe is true', () => {
    const { toJSON } = render(
      <ReviewSection {...defaultProps} isOwnRecipe={true} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('shows empty text when no reviews', () => {
    const { getByText } = render(<ReviewSection {...defaultProps} />);
    expect(
      getByText('No reviews yet. Be the first to review this recipe!'),
    ).toBeTruthy();
  });

  it('shows Write a Review button when not reviewed', () => {
    const { getByText } = render(<ReviewSection {...defaultProps} />);
    expect(getByText('Write a Review')).toBeTruthy();
  });

  it('shows Your Review label when user has reviewed', () => {
    const userReview = {
      id: 'r1',
      rating: 5,
      comment: 'Great!',
      helpful: 0,
      verified: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      user: { id: 'u1', email: 'test@test.com', profile: null },
    } as RecipeReviewFragment;
    const { getByText } = render(
      <ReviewSection
        {...defaultProps}
        hasReviewed={true}
        userReview={userReview}
        totalReviews={1}
        reviews={[userReview]}
      />,
    );
    expect(getByText('Your Review')).toBeTruthy();
  });
});
