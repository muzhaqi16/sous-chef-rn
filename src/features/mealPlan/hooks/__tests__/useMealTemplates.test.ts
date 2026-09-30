import { act, waitFor } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { GetMealTemplatesDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { useMealTemplates } from '../useMealTemplates';

describe('useMealTemplates search', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sends one request for a burst of keystrokes, with the settled term', async () => {
    const templates = recordMock(GetMealTemplatesDocument, {
      data: {
        mealTemplates: {
          edges: [],
          pageInfo: { hasNextPage: false, endCursor: null },
        },
      },
    });

    const { result } = renderHookWithApollo(() => useMealTemplates(), {
      operationMocks: [templates.mock],
    });
    await waitFor(() => expect(result.current.state.hasResult).toBe(true));
    const beforeTyping = templates.fired.length;

    for (const term of ['p', 'pa', 'pas', 'past', 'pasta']) {
      act(() => result.current.actions.setSearchQuery(term));
      act(() => {
        jest.advanceTimersByTime(50);
      });
    }
    act(() => {
      jest.advanceTimersByTime(300);
    });

    await waitFor(() => expect(templates.fired.length).toBe(beforeTyping + 1));
    expect(templates.fired.at(-1)).toMatchObject({
      filters: { search: 'pasta' },
    });
  });
});
