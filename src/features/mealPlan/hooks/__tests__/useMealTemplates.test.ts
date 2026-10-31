import { act } from '@testing-library/react-native';
import {
  recordMock,
  renderHookWithApollo,
} from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';
import { GetMealTemplatesDocument } from '#features/mealPlan/graphql/mealTemplate.generated';
import { useMealTemplates } from '../useMealTemplates';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useMealTemplates search', () => {
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
    await drainTimers();
    expect(result.current.state.hasResult).toBe(true);
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

    await drainTimers();
    expect(templates.fired.length).toBe(beforeTyping + 1);
    expect(templates.fired.at(-1)).toMatchObject({
      filters: { search: 'pasta' },
    });
  });
});
