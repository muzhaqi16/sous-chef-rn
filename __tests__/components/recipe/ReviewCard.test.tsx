'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { ReviewCard } from '../../../src/components/recipe/ReviewCard';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('../../../src/components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));

const makeReview = (overrides = {}) => ({
  id: 'r1',
  rating: 4,
  comment: 'Great recipe!',
  helpful: 2,
  verified: false,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
  user: {
    id: 'u1',
    email: 'test@test.com',
    profile: { displayName: 'Test User', avatar: null },
  },
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
    const { getByText } = render(<ReviewCard {...defaultProps} />);
    expect(getByText('Test User')).toBeTruthy();
  });

  it('renders comment text', () => {
    const { getByText } = render(<ReviewCard {...defaultProps} />);
    expect(getByText('Great recipe!')).toBeTruthy();
  });

  it('renders helpful button with count', () => {
    const { getByText } = render(<ReviewCard {...defaultProps} />);
    expect(getByText('Helpful (2)')).toBeTruthy();
  });

  it('falls back to email when no displayName', () => {
    const review = makeReview({
      user: { id: 'u1', email: 'fallback@test.com', profile: null },
    });
    const { getByText } = render(
      <ReviewCard {...defaultProps} review={review as any} />,
    );
    expect(getByText('fallback@test.com')).toBeTruthy();
  });

  it('shows edit and delete buttons when isOwn', () => {
    const { toJSON } = render(
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
