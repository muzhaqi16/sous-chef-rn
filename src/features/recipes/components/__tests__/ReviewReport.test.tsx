import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import {
  CreateOutcome,
  ModerationContentType,
  ReportType,
} from '#/graphql/generated/schemaTypes';
import { useStore } from '#store';
import type { RecipeReviewFragment } from '#features/recipes/graphql/recipeFragments.generated';
import { CreateUserReportDocument } from '#features/profile/hooks/useReportContent.generated';
import { profileTestIDs } from '#features/profile/testIDs';
import { recipesTestIDs } from '#features/recipes/testIDs';
import { ReviewCard } from '../ReviewCard';
import { ReviewSection } from '../ReviewSection';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');
jest.mock('#components/atoms/CachedImage', () => ({
  CachedImage: () => null,
}));
jest.mock('#services/toastService', () => ({
  toastService: { success: jest.fn(), info: jest.fn() },
}));

const VIEWER = {
  id: 'viewer',
  email: 'viewer@example.com',
  emailVerified: true,
  onBoarded: true,
  preferredCurrency: 'USD',
};

const review = (id: string, authorId: string | null): RecipeReviewFragment => ({
  __typename: 'RecipeReview',
  id,
  rating: 4,
  comment: 'Too salty',
  helpful: 0,
  verified: false,
  createdAt: '2026-10-01T09:00:00.000Z',
  updatedAt: '2026-10-01T09:00:00.000Z',
  user: authorId
    ? {
        __typename: 'User',
        id: authorId,
        email: null,
        displayName: null,
        profile: null,
      }
    : null,
  viewerHasVotedHelpful: false,
});

const reportButton = (reviewId: string) =>
  screen.queryByTestId(recipesTestIDs.reviewReportButton(reviewId));

function renderCard(subject: RecipeReviewFragment) {
  const onReport = jest.fn();
  renderWithApollo(
    <ReviewCard
      review={subject}
      isOwn={false}
      hasVotedHelpful={false}
      onToggleHelpful={jest.fn()}
      onReport={onReport}
    />,
  );
  return onReport;
}

beforeEach(() => {
  useStore.setState({ user: VIEWER });
});

afterEach(() => {
  useStore.setState({ user: null });
});

describe('reporting a review from its card', () => {
  it("offers a report on someone else's review, naming its author", () => {
    const onReport = renderCard(review('review-2', 'author'));

    const button = reportButton('review-2');
    expect(button).toBeTruthy();
    if (button) fireEvent.press(button);

    expect(onReport).toHaveBeenCalledWith('author');
  });

  it("offers none on the viewer's own review", () => {
    renderCard(review('review-1', VIEWER.id));

    expect(reportButton('review-1')).toBeNull();
  });

  it('offers none once the author deleted their account', () => {
    renderCard(review('review-3', null));

    expect(reportButton('review-3')).toBeNull();
  });
});

describe('reporting a review from the recipe', () => {
  it('sends the review and its author with the chosen reason', async () => {
    const mock = recordMock(CreateUserReportDocument, {
      data: {
        createUserReport: {
          __typename: 'CreateUserReportPayload',
          outcome: CreateOutcome.Created,
        },
      },
    });
    const own = review('review-1', VIEWER.id);
    const other = review('review-2', 'author');
    renderWithApollo(
      <ReviewSection
        reviews={[own, other]}
        totalReviews={2}
        averageRating={4}
        rating1Count={0}
        rating2Count={0}
        rating3Count={0}
        rating4Count={2}
        rating5Count={0}
        userReview={own}
        hasReviewed
        isOwnRecipe={false}
        createReview={jest.fn()}
        updateReview={jest.fn()}
        deleteReview={jest.fn()}
        toggleHelpful={jest.fn()}
        hasVotedHelpful={() => false}
        submitting={false}
      />,
      { operationMocks: [mock.mock] },
    );

    expect(reportButton('review-1')).toBeNull();
    const button = reportButton('review-2');
    expect(button).toBeTruthy();
    if (button) fireEvent.press(button);

    fireEvent.press(
      await screen.findByTestId(profileTestIDs.reportReason(ReportType.Spam)),
    );
    fireEvent.press(screen.getByTestId(profileTestIDs.reportSendButton));

    await waitFor(() =>
      expect(mock.fired).toEqual([
        {
          input: {
            reportedUserId: 'author',
            contentType: ModerationContentType.RecipeReview,
            contentId: 'review-2',
            type: ReportType.Spam,
          },
        },
      ]),
    );
  });
});
