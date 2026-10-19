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
  ReportStatus,
  ReportType,
} from '#/graphql/generated/schemaTypes';
import { formatShortDate } from '#/utils/formatters/date';
import { profileTestIDs } from '#features/profile/testIDs';
import { MyUserReportsDocument } from '../useMyReports.generated';
import { MyReportsScreen } from '../MyReportsScreen';

jest.mock('#hooks/navigation/useAppNavigation');

type Page = MockDataFor<typeof MyUserReportsDocument>;

interface Report {
  id: string;
  type: ReportType;
  status: ReportStatus;
  contentType: ModerationContentType | null;
}

const CREATED_AT = '2026-10-03T09:00:00.000Z';

const page = (reports: Report[], endCursor: string | null = null): Page => ({
  myUserReports: {
    edges: reports.map(report => ({
      node: { createdAt: CREATED_AT, ...report },
    })),
    pageInfo: { hasNextPage: endCursor !== null, endCursor },
  },
});

const REPORTS: Report[] = [
  {
    id: 'report-4',
    type: ReportType.Spam,
    status: ReportStatus.Pending,
    contentType: ModerationContentType.Recipe,
  },
  {
    id: 'report-3',
    type: ReportType.Harassment,
    status: ReportStatus.Investigating,
    contentType: ModerationContentType.RecipeReview,
  },
  {
    id: 'report-2',
    type: ReportType.Impersonation,
    status: ReportStatus.Resolved,
    contentType: ModerationContentType.Profile,
  },
  {
    id: 'report-1',
    type: ReportType.Other,
    status: ReportStatus.Dismissed,
    contentType: null,
  },
];

const row = (id: string) =>
  within(screen.getByTestId(profileTestIDs.reportRow(id)));

describe('MyReportsScreen', () => {
  it('shows what each report was about, its reason, its date and where it stands', async () => {
    renderWithApollo(<MyReportsScreen />, {
      operationMocks: [
        recordMock(MyUserReportsDocument, { data: page(REPORTS) }).mock,
      ],
    });

    await screen.findByTestId(profileTestIDs.reportRow('report-4'));
    const reported = `Reported ${formatShortDate(new Date(CREATED_AT))}`;
    const expected: Array<[string, string, string, string]> = [
      ['report-4', 'Recipe report', 'Spam', 'Waiting for review'],
      ['report-3', 'Review report', 'Harassment or bullying', 'Under review'],
      ['report-2', 'Profile report', 'Impersonation', 'Upheld'],
      ['report-1', 'User report', 'Other', 'Closed'],
    ];
    for (const [id, ...texts] of expected) {
      for (const text of [...texts, reported]) {
        expect(row(id).getByText(text)).toBeTruthy();
      }
    }
  });

  it('says there are no reports rather than showing an empty list', async () => {
    renderWithApollo(<MyReportsScreen />, {
      operationMocks: [
        recordMock(MyUserReportsDocument, { data: page([]) }).mock,
      ],
    });

    expect(await screen.findByText('No reports yet')).toBeTruthy();
  });

  it('loads the next page when the list reaches its end', async () => {
    const [newer, ...older] = REPORTS;
    const mock = recordMock(MyUserReportsDocument, {
      dataFor: vars =>
        vars.after === 'cursor-1'
          ? page(older)
          : page(newer ? [newer] : [], 'cursor-1'),
    });
    renderWithApollo(<MyReportsScreen />, { operationMocks: [mock.mock] });
    await screen.findByTestId(profileTestIDs.reportRow('report-4'));
    expect(
      screen.queryByTestId(profileTestIDs.reportRow('report-1')),
    ).toBeNull();

    act(() => {
      screen.UNSAFE_getByType(FlashList).props.onEndReached();
    });

    expect(
      await screen.findByTestId(profileTestIDs.reportRow('report-1')),
    ).toBeTruthy();
    expect(mock.fired).toContainEqual({ first: 20, after: 'cursor-1' });
  });
});
