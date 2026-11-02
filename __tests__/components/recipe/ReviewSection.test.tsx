'use no memo';

import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { t } from '#/i18n';
import type { DataState } from '#hooks/data/useDataState';
import { ReviewSection } from '../../../src/features/recipes/components/ReviewSection';
import type { RecipeReviewFragment } from '../../../src/features/recipes/graphql/recipeFragments.generated';

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
  reviewsState: 'empty' as DataState,
  retryReviews: jest.fn(),
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
  it('says the reviews could not be read and offers to read them again', async () => {
    const retryReviews = jest.fn();
    render(
      <ReviewSection
        {...defaultProps}
        reviewsState="error"
        retryReviews={retryReviews}
      />,
    );

    expect(screen.getByText(t('dataState.errorTitle'))).toBeTruthy();
    expect(screen.queryByText(t('recipes.noReviews'))).toBeNull();
    // Unread, a review the viewer already wrote cannot be told from none.
    expect(screen.queryByText(t('recipes.writeReview'))).toBeNull();

    await userEvent.setup().press(screen.getByText(t('labels.tryAgain')));
    expect(retryReviews).toHaveBeenCalledTimes(1);
  });

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
