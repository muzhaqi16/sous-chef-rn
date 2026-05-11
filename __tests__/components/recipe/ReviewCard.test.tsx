'use no memo';

import React from 'react';
import { ReviewCard } from '#features/recipes/components/ReviewCard';
import { renderWithApollo } from '#/test-utils/apolloMockProvider';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

const makeReview = (overrides = {}) => ({
  __typename: 'RecipeReview',
  id: 'r1',
  rating: 4,
  comment: 'Great recipe!',
  helpful: 2,
  verified: false,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  user: {
    __typename: 'User',
    id: 'u1',
    email: 'test@test.com',
    profile: {
      __typename: 'UserProfile',
      id: 'p1',
      displayName: 'Test User',
      avatar: null,
    },
  },
  helpfulVotes: [],
  ...overrides,
});

describe('ReviewCard', () => {
  const defaultProps = {
    review: makeReview() as any,
    isOwn: false,
    hasVotedHelpful: false,
    onToggleHelpful: jest.fn(),
  };

  it('renders display name', () => {
    const { getByText } = renderWithApollo(<ReviewCard {...defaultProps} />);
    expect(getByText('Test User')).toBeTruthy();
  });

  it('renders comment text', () => {
    const { getByText } = renderWithApollo(<ReviewCard {...defaultProps} />);
    expect(getByText('Great recipe!')).toBeTruthy();
  });

  it('renders helpful button with count', () => {
    const { getByText } = renderWithApollo(<ReviewCard {...defaultProps} />);
    expect(getByText('Helpful (2)')).toBeTruthy();
  });

  it('falls back to email when no displayName', () => {
    const review = makeReview({
      user: {
        __typename: 'User',
        id: 'u1',
        email: 'fallback@test.com',
        profile: null,
      },
    });
    const { getByText } = renderWithApollo(
      <ReviewCard {...defaultProps} review={review as any} />,
    );
    expect(getByText('fallback@test.com')).toBeTruthy();
  });

  it('shows edit and delete buttons when isOwn', () => {
    const { toJSON } = renderWithApollo(
      <ReviewCard
        {...defaultProps}
        isOwn={true}
        onEdit={jest.fn()}
        onDelete={jest.fn()}
      />,
    );
    expect(toJSON()).toBeTruthy();
  });
});
