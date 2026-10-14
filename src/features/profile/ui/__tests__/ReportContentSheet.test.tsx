import React from 'react';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreateOutcome,
  ErrorCode,
  ModerationContentType,
  ReportType,
} from '#/graphql/generated/schemaTypes';
import { t } from '#/i18n';
import { profileTestIDs } from '#features/profile/testIDs';
import { CreateUserReportDocument } from '#features/profile/hooks/useReportContent.generated';
import { ReportContentSheet, type ReportTarget } from '../ReportContentSheet';

const mockToastSuccess = jest.fn();
const mockToastInfo = jest.fn();
jest.mock('#services/toastService', () => ({
  toastService: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    info: (...args: unknown[]) => mockToastInfo(...args),
  },
}));

const TARGET: ReportTarget = {
  reportedUserId: 'user-2',
  contentType: ModerationContentType.RecipeReview,
  contentId: 'review-1',
};

type Member = MockDataFor<typeof CreateUserReportDocument>['createUserReport'];

const accepted = (outcome: CreateOutcome): Member => ({
  __typename: 'CreateUserReportPayload',
  outcome,
});

function renderSheet(member: Member = accepted(CreateOutcome.Created)) {
  const mock = recordMock(CreateUserReportDocument, {
    data: { createUserReport: member },
  });
  const onDismiss = jest.fn();
  renderWithApollo(
    <ReportContentSheet visible target={TARGET} onDismiss={onDismiss} />,
    { operationMocks: [mock.mock] },
  );
  return { fired: mock.fired, onDismiss };
}

const pick = (reason: ReportType) =>
  fireEvent.press(screen.getByTestId(profileTestIDs.reportReason(reason)));
const describeIt = (text: string) =>
  fireEvent.changeText(
    screen.getByTestId(profileTestIDs.reportDescriptionInput),
    text,
  );
const send = () =>
  fireEvent.press(screen.getByTestId(profileTestIDs.reportSendButton));

beforeEach(() => {
  jest.clearAllMocks();
});

describe('ReportContentSheet', () => {
  it('offers every reason the server lists', () => {
    renderSheet();

    for (const reason of Object.values(ReportType)) {
      expect(
        screen.getByTestId(profileTestIDs.reportReason(reason)),
      ).toBeTruthy();
    }
  });

  it('asks for a reason before sending anything', async () => {
    const { fired, onDismiss } = renderSheet();

    send();

    expect(await screen.findByText(t('reports.reasonRequired'))).toBeTruthy();
    expect(fired).toEqual([]);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('sends a listed reason with no description', async () => {
    const { fired, onDismiss } = renderSheet();

    pick(ReportType.Spam);
    send();

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(fired).toEqual([{ input: { ...TARGET, type: ReportType.Spam } }]);
    expect(mockToastSuccess).toHaveBeenCalledWith(t('reports.sent'));
  });

  it('requires a description for "other", on the description field', async () => {
    const { fired, onDismiss } = renderSheet();

    pick(ReportType.Other);
    describeIt('   ');
    send();

    expect(
      await screen.findByText(t('reports.descriptionRequired')),
    ).toBeTruthy();
    expect(fired).toEqual([]);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('sends "other" once it says what happened', async () => {
    const { fired, onDismiss } = renderSheet();

    pick(ReportType.Other);
    describeIt('  Posted my address in the comments.  ');
    send();

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(fired).toEqual([
      {
        input: {
          ...TARGET,
          type: ReportType.Other,
          description: 'Posted my address in the comments.',
        },
      },
    ]);
  });

  it('drops the description requirement when the reason stops being "other"', async () => {
    renderSheet();

    pick(ReportType.Other);
    send();
    await screen.findByText(t('reports.descriptionRequired'));

    pick(ReportType.Harassment);

    await waitFor(() =>
      expect(screen.queryByText(t('reports.descriptionRequired'))).toBeNull(),
    );
  });

  it('says a repeat is already under review instead of implying a second report', async () => {
    const { onDismiss } = renderSheet(accepted(CreateOutcome.Merged));

    pick(ReportType.Spam);
    send();

    await waitFor(() => expect(onDismiss).toHaveBeenCalledTimes(1));
    expect(mockToastInfo).toHaveBeenCalledWith(t('reports.alreadyOpen'));
    expect(mockToastSuccess).not.toHaveBeenCalled();
  });

  it('shows a refusal and stays open with what was written', async () => {
    const { onDismiss } = renderSheet({
      __typename: 'ForbiddenError',
      code: ErrorCode.Forbidden,
      message: 'raw server words',
    });

    pick(ReportType.Other);
    describeIt('They copied my recipe.');
    send();

    expect(
      await screen.findByTestId(profileTestIDs.reportFailure),
    ).toHaveTextContent(t('errors.codes.forbidden'));
    expect(onDismiss).not.toHaveBeenCalled();
    expect(mockToastSuccess).not.toHaveBeenCalled();
    expect(
      screen.getByTestId(profileTestIDs.reportDescriptionInput),
    ).toHaveProp('value', 'They copied my recipe.');
    expect(
      screen.getByTestId(profileTestIDs.reportReason(ReportType.Other)),
    ).toBeChecked();
  });
});
