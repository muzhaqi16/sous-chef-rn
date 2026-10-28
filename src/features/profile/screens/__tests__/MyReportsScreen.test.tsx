import React from 'react';
import { FlashList } from '@shopify/flash-list';
import { act, screen, within } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  ModerationContentType,
  ReportType,
  ReviewSubmissionStatus,
} from '#/graphql/generated/schemaTypes';
import { formatShortDate } from '#/utils/formatters/date';
import { profileTestIDs } from '#features/profile/testIDs';
import { MyReviewSubmissionsDocument } from '../useMyReports.generated';
import { MyReportsScreen } from '../MyReportsScreen';

jest.mock('#hooks/navigation/useAppNavigation');

type Page = MockDataFor<typeof MyReviewSubmissionsDocument>;
type Submission = NonNullable<
  NonNullable<NonNullable<Page['myReviewSubmissions']>['edges']>[number]
>['node'];

const SENT_AT = '2026-10-03T09:00:00.000Z';

const page = (
  submissions: Submission[],
  endCursor: string | null = null,
): Page => ({
  myReviewSubmissions: {
    edges: submissions.map(node => ({
      node: { sentAt: SENT_AT, senderNote: null, reviewNote: null, ...node },
    })),
    pageInfo: { hasNextPage: endCursor !== null, endCursor },
  },
});

const SUBMISSIONS: Submission[] = [
  {
    __typename: 'UserReportSubmission',
    id: 'recipe-report',
    status: ReviewSubmissionStatus.Pending,
    report: {
      type: ReportType.Spam,
      contentType: ModerationContentType.Recipe,
    },
    reportedUser: { displayName: 'Sam' },
    recipe: { name: 'Easy Fruit Pie' },
  },
  {
    __typename: 'UserReportSubmission',
    id: 'profile-report',
    status: ReviewSubmissionStatus.Accepted,
    report: {
      type: ReportType.Impersonation,
      contentType: ModerationContentType.Profile,
    },
    reportedUser: { displayName: 'Sam' },
    recipe: null,
  },
  {
    __typename: 'ItemSuggestionSubmission',
    id: 'edit',
    status: ReviewSubmissionStatus.Declined,
    senderNote: 'The net weight on the label is 16 oz',
    reviewNote: 'The label we hold says 10 oz',
    item: { name: 'Roasted Garlic Hummus' },
  },
  {
    __typename: 'ItemPhotoSubmission',
    id: 'photo',
    status: ReviewSubmissionStatus.InReview,
    item: { name: 'Deviled Egg Sandwich' },
    photo: { url: 'https://cdn.test/photo.jpg', variants: [] },
  },
  {
    __typename: 'ItemReportSubmission',
    id: 'item-report',
    status: ReviewSubmissionStatus.Declined,
    senderNote: 'Wrong brand',
    item: { name: 'Whole Milk' },
    photo: null,
  },
];

const row = (id: string) =>
  within(screen.getByTestId(profileTestIDs.reportRow(id)));

describe('MyReportsScreen', () => {
  it('shows each thing sent for review: what, why, when, and where it stands', async () => {
    renderWithApollo(<MyReportsScreen />, {
      operationMocks: [
        recordMock(MyReviewSubmissionsDocument, { data: page(SUBMISSIONS) })
          .mock,
      ],
    });

    await screen.findByTestId(profileTestIDs.reportRow('recipe-report'));
    const sent = `Sent ${formatShortDate(new Date(SENT_AT))}`;
    const expected: Array<[string, ...string[]]> = [
      [
        'recipe-report',
        'Easy Fruit Pie',
        'Recipe report · Spam',
        'Waiting for review',
      ],
      ['profile-report', 'Sam', 'Profile report · Impersonation', 'Upheld'],
      [
        'edit',
        'Roasted Garlic Hummus',
        'Suggested edit',
        'The net weight on the label is 16 oz',
        "Reviewer's note: The label we hold says 10 oz",
        'Declined',
      ],
      ['photo', 'Deviled Egg Sandwich', 'Photo for review', 'Under review'],
      ['item-report', 'Whole Milk', 'Item report', 'Wrong brand', 'Closed'],
    ];
    for (const [id, ...texts] of expected) {
      for (const text of [...texts, sent]) {
        expect(row(id).getByText(text)).toBeTruthy();
      }
    }
  });

  it('says nothing was sent rather than showing an empty list', async () => {
    renderWithApollo(<MyReportsScreen />, {
      operationMocks: [
        recordMock(MyReviewSubmissionsDocument, { data: page([]) }).mock,
      ],
    });

    expect(await screen.findByText('Nothing sent for review yet')).toBeTruthy();
  });

  it('loads the next page when the list reaches its end', async () => {
    const [newer, ...older] = SUBMISSIONS;
    const mock = recordMock(MyReviewSubmissionsDocument, {
      dataFor: vars =>
        vars.after === 'cursor-1'
          ? page(older)
          : page(newer ? [newer] : [], 'cursor-1'),
    });
    renderWithApollo(<MyReportsScreen />, { operationMocks: [mock.mock] });
    await screen.findByTestId(profileTestIDs.reportRow('recipe-report'));
    expect(
      screen.queryByTestId(profileTestIDs.reportRow('item-report')),
    ).toBeNull();

    act(() => {
      screen.UNSAFE_getByType(FlashList).props.onEndReached();
    });

    expect(
      await screen.findByTestId(profileTestIDs.reportRow('item-report')),
    ).toBeTruthy();
    expect(mock.fired).toContainEqual({ first: 20, after: 'cursor-1' });
  });
});
