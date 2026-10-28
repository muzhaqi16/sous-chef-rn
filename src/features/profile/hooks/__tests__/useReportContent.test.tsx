import React, { type ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react-native';
import { ApolloClient, ApolloLink } from '@apollo/client';
import { ApolloProvider, useApolloClient } from '@apollo/client/react';
import { MockLink } from '@apollo/client/testing';
import { makeCache } from '#/apollo/cache';
import { APOLLO_DEFAULT_OPTIONS } from '#/apollo/defaultOptions';
import { createQueueLink } from '#/apollo/offlineQueue/queueLink';
import { queueStore } from '#/apollo/offlineQueue/queueStore';
import {
  recordMock,
  renderHookWithApollo,
  type MockDataFor,
} from '#/test-utils/apolloMockProvider';
import {
  CreateOutcome,
  ErrorCode,
  ModerationContentType,
  ReportType,
} from '#/graphql/generated/schemaTypes';
import { NetworkRequestError } from '#/utils/errors/networkRequestError';
import { useStore } from '#store';
import { t } from '#/i18n';
import { MyUserReportReadersFragmentDoc } from '#/graphql/readers/myUserReportReaders.generated';
import { CreateUserReportDocument } from '../useReportContent.generated';
import { useReportContent, type ReportOutcome } from '../useReportContent';

jest.mock('#/apollo/offlineQueue/queueManager', () => ({
  queueManager: {
    requestDrain: jest.fn(),
    withdrawUnqueueableWrite: jest.fn(),
  },
}));

const INPUT = {
  reportedUserId: 'user-2',
  type: ReportType.Spam,
  contentType: ModerationContentType.RecipeReview,
  contentId: 'review-1',
};

type Member = MockDataFor<typeof CreateUserReportDocument>['createUserReport'];

const payload = (outcome: CreateOutcome): Member => ({
  __typename: 'CreateUserReportPayload',
  outcome,
  userReport: {
    __typename: 'MyUserReport',
    id: 'report-1',
    type: ReportType.Spam,
    contentType: ModerationContentType.RecipeReview,
  },
});

function useReportContentWithClient() {
  return { ...useReportContent(), client: useApolloClient() };
}

async function reportWith(response: { data: Member } | { error: Error }) {
  const mock = recordMock(
    CreateUserReportDocument,
    'error' in response
      ? response
      : { data: { createUserReport: response.data } },
  );
  const { result } = renderHookWithApollo(() => useReportContentWithClient(), {
    operationMocks: [mock.mock],
  });
  let outcome: ReportOutcome | undefined;
  await act(async () => {
    outcome = await result.current.reportContent(INPUT);
  });
  return { outcome, fired: mock.fired, client: result.current.client };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useReportContent', () => {
  it('sends a first report and keeps what the server returned for My reports', async () => {
    const { outcome, fired, client } = await reportWith({
      data: payload(CreateOutcome.Created),
    });

    expect(outcome).toEqual({ status: 'sent' });
    expect(fired).toEqual([{ input: INPUT }]);
    // What My reports reads on the report is complete off the response.
    expect(
      client.cache.readFragment({
        fragment: MyUserReportReadersFragmentDoc,
        fragmentName: 'MyUserReportReaders',
        id: client.cache.identify({
          __typename: 'MyUserReport',
          id: 'report-1',
        }),
      }),
    ).toEqual(
      expect.objectContaining({
        id: 'report-1',
        type: ReportType.Spam,
      }),
    );
  });

  it('says so when the earlier report on the same content is still open', async () => {
    const { outcome } = await reportWith({
      data: payload(CreateOutcome.Merged),
    });

    expect(outcome).toEqual({ status: 'alreadyOpen' });
  });

  it("gives a refusal its code's own copy, never the server's words", async () => {
    const { outcome } = await reportWith({
      data: {
        __typename: 'ForbiddenError',
        code: ErrorCode.Forbidden,
        message: 'raw server words',
      },
    });

    expect(outcome).toEqual({
      status: 'failed',
      body: t('errors.codes.forbidden'),
    });
  });

  it('names the content a refusal says is gone', async () => {
    const { outcome } = await reportWith({
      data: {
        __typename: 'NotFoundError',
        code: ErrorCode.NotFound,
        message: 'raw server words',
        resource: 'RecipeReview',
      },
    });

    expect(outcome).toEqual({
      status: 'failed',
      body: t('errors.notFoundResource', {
        resource: t('errors.resourceNames.RecipeReview'),
      }),
    });
  });

  it('says a report needs a connection when the request never got an answer', async () => {
    const { outcome } = await reportWith({
      error: new NetworkRequestError('Network request failed'),
    });

    expect(outcome).toEqual({
      status: 'failed',
      body: t('reports.needsConnection'),
    });
  });
});

describe('useReportContent while offline', () => {
  beforeEach(() => {
    useStore.setState({ isOnline: false, apiReachable: null });
  });

  afterEach(() => {
    useStore.setState({ isOnline: true, apiReachable: null });
  });

  it('is refused by the queue rather than held for later', async () => {
    const forwarded: string[] = [];
    const tap = new ApolloLink((operation, forward) => {
      forwarded.push(operation.operationName ?? '');
      return forward(operation);
    });
    const addMutation = jest.spyOn(queueStore, 'addMutation');
    const client = new ApolloClient({
      cache: makeCache(),
      link: ApolloLink.from([createQueueLink(), tap, new MockLink([])]),
      defaultOptions: APOLLO_DEFAULT_OPTIONS,
    });
    const wrapper = ({ children }: { children: ReactNode }) => (
      <ApolloProvider client={client}>{children}</ApolloProvider>
    );
    const { result } = renderHook(() => useReportContent(), { wrapper });

    let outcome: ReportOutcome | undefined;
    await act(async () => {
      outcome = await result.current.reportContent(INPUT);
    });

    expect(outcome).toEqual({
      status: 'failed',
      body: t('reports.needsConnection'),
    });
    expect(forwarded).toEqual([]);
    expect(addMutation).not.toHaveBeenCalled();
  });
});
