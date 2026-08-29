import { act } from '@testing-library/react-native';
import { gql } from '@apollo/client';
import {
  recordMock,
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealTemplateDocument,
  UpdateMealTemplateDocument,
  AddTemplateItemDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { TemplateCategory, MealType } from '#/graphql/generated/schemaTypes';
import type { RootState } from '#store';
import { useMealTemplateEditor } from '../useMealTemplateEditor';

// Template authoring is online-only, and `useIsApiUnavailable` reads the network
// signals through the store — mutable per test so a case can go offline.
const mockStoreState = { isOnline: true, apiReachable: true };

jest.mock('#store/useAppStore', () => ({
  useAppStore: (selector: (s: RootState) => unknown) =>
    selector(mockStoreState as RootState),
}));

const mockToastError = jest.fn();
jest.mock('#/services/toastService', () => ({
  toastService: {
    success: jest.fn(),
    error: (...args: unknown[]) => mockToastError(...args),
    info: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  mockStoreState.isOnline = true;
  mockStoreState.apiReachable = true;
});

const TEMPLATE = {
  __typename: 'MealTemplate',
  id: 'tpl-1',
  name: 'Weeknight Dinners',
  description: null,
  category: TemplateCategory.Weekly,
  defaultServings: 2,
  tags: [],
  updatedAt: '2026-01-01T00:00:00Z',
};

const TemplateNameFragment = gql`
  fragment _TemplateName on MealTemplate {
    id
    name
  }
`;

const readTemplate = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ name: string }>({
    id: cache.identify({ __typename: 'MealTemplate', id: 'tpl-1' }),
    fragment: TemplateNameFragment,
    fragmentName: '_TemplateName',
  });

const NEW_TEMPLATE_INPUT = {
  name: 'New',
  category: TemplateCategory.Weekly,
  items: [],
};

const NEW_ITEM_INPUT = {
  templateId: 'tpl-1',
  dayOffset: 0,
  mealType: MealType.Breakfast,
  meal: { customMealName: 'Oats' },
  servings: 1,
};

describe('useMealTemplateEditor', () => {
  it('createTemplate returns the minted id when the server accepts it', async () => {
    const create = recordMock(CreateMealTemplateDocument, {
      data: {
        createMealTemplate: {
          __typename: 'CreateMealTemplatePayload',
          mealTemplate: {
            __typename: 'MealTemplate',
            id: 'tpl-new',
            category: TemplateCategory.Weekly,
          },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [create.mock],
    });

    let id: string | null = null;
    await act(async () => {
      id = await result.current.createTemplate(NEW_TEMPLATE_INPUT);
    });
    expect(typeof id).toBe('string');
    expect(id).toBeTruthy();
    expect(create.fired).toHaveLength(1);
  });

  it('createTemplate returns null on a rejection', async () => {
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [
        {
          request: {
            query: CreateMealTemplateDocument,
            variables: () => true,
          },
          result: {
            data: {
              createMealTemplate: {
                __typename: 'ValidationError',
                code: 'VALIDATION_ERROR',
                message: 'bad',
                field: 'name',
              },
            },
          },
        },
      ],
    });

    let id: string | null = 'unset';
    await act(async () => {
      id = await result.current.createTemplate({
        ...NEW_TEMPLATE_INPUT,
        name: '',
      });
    });
    expect(id).toBeNull();
  });

  it('createTemplate refuses offline without firing the mutation', async () => {
    mockStoreState.apiReachable = false;
    const create = recordMock(CreateMealTemplateDocument, {
      data: {
        createMealTemplate: {
          __typename: 'CreateMealTemplatePayload',
          mealTemplate: {
            __typename: 'MealTemplate',
            id: 'tpl-new',
            category: TemplateCategory.Weekly,
          },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [create.mock],
    });

    expect(result.current.isApiUnavailable).toBe(true);

    let id: string | null = 'unset';
    await act(async () => {
      id = await result.current.createTemplate(NEW_TEMPLATE_INPUT);
    });
    expect(id).toBeNull();
    expect(create.fired).toHaveLength(0);
    expect(mockToastError).toHaveBeenCalled();
  });

  it('updateTemplate returns true and takes the server response', async () => {
    const cache = seedCache([TEMPLATE]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateMealTemplateDocument,
            variables: () => true,
          },
          result: {
            data: {
              updateMealTemplate: {
                __typename: 'UpdateMealTemplatePayload',
                mealTemplate: {
                  __typename: 'MealTemplate',
                  id: 'tpl-1',
                  name: 'Renamed',
                },
              },
            },
          },
        },
      ],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.updateTemplate('tpl-1', { name: 'Renamed' });
    });
    expect(ok).toBe(true);
    expect(readTemplate(cache)?.name).toBe('Renamed');
  });

  it('updateTemplate returns false on a rejection and leaves the cache alone', async () => {
    const cache = seedCache([TEMPLATE]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateMealTemplateDocument,
            variables: () => true,
          },
          result: {
            data: {
              updateMealTemplate: {
                __typename: 'ValidationError',
                code: 'VALIDATION_ERROR',
                message: 'nope',
                field: 'name',
              },
            },
          },
        },
      ],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.updateTemplate('tpl-1', { name: 'Renamed' });
    });
    expect(ok).toBe(false);
    expect(readTemplate(cache)?.name).toBe('Weeknight Dinners');
  });

  it('updateTemplate refuses offline and never touches the cached template', async () => {
    mockStoreState.apiReachable = false;
    const cache = seedCache([TEMPLATE]);
    const update = recordMock(UpdateMealTemplateDocument, {
      data: {
        updateMealTemplate: {
          __typename: 'UpdateMealTemplatePayload',
          mealTemplate: {
            __typename: 'MealTemplate',
            id: 'tpl-1',
            name: 'Renamed',
          },
        },
      },
    });
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [update.mock],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.updateTemplate('tpl-1', { name: 'Renamed' });
    });
    expect(ok).toBe(false);
    expect(update.fired).toHaveLength(0);
    expect(readTemplate(cache)?.name).toBe('Weeknight Dinners');
    expect(mockToastError).toHaveBeenCalled();
  });

  it('addItem returns false on a rejection', async () => {
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [
        {
          request: { query: AddTemplateItemDocument, variables: () => true },
          result: {
            data: {
              addTemplateItem: {
                __typename: 'ValidationError',
                code: 'VALIDATION_ERROR',
                message: 'nope',
                field: 'mealType',
              },
            },
          },
        },
      ],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.addItem(NEW_ITEM_INPUT);
    });
    expect(ok).toBe(false);
  });

  it('addItem refuses offline without firing the mutation', async () => {
    mockStoreState.apiReachable = false;
    const add = recordMock(AddTemplateItemDocument, {
      data: {
        addTemplateItem: {
          __typename: 'ValidationError',
          code: 'VALIDATION_ERROR',
          message: 'nope',
          field: 'mealType',
        },
      },
    });
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [add.mock],
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.addItem(NEW_ITEM_INPUT);
    });
    expect(ok).toBe(false);
    expect(add.fired).toHaveLength(0);
    expect(mockToastError).toHaveBeenCalled();
  });
});
