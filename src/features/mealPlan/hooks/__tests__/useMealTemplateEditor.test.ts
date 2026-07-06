import { act, waitFor } from '@testing-library/react-native';
import {
  renderHookWithApollo,
  seedCache,
} from '#/test-utils/apolloMockProvider';
import {
  CreateMealTemplateDocument,
  UpdateMealTemplateDocument,
  AddTemplateItemDocument,
} from '#features/mealPlan/graphql/mealTemplate.generated';
import { UseMealTemplateEditor_TemplateFragmentDoc } from '../useMealTemplateEditor.generated';
import { TemplateCategory, MealType } from '#/graphql/generated/schemaTypes';
import { useMealTemplateEditor } from '../useMealTemplateEditor';

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

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

const readTemplate = (cache: ReturnType<typeof seedCache>) =>
  cache.readFragment<{ name: string; category: TemplateCategory }>({
    id: cache.identify({ __typename: 'MealTemplate', id: 'tpl-1' }),
    fragment: UseMealTemplateEditor_TemplateFragmentDoc,
    fragmentName: 'useMealTemplateEditor_template',
  });

describe('useMealTemplateEditor', () => {
  it('createTemplate returns the minted id when the create is queued offline', async () => {
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      operationMocks: [
        {
          request: {
            query: CreateMealTemplateDocument,
            variables: () => true,
          },
          result: { data: { createMealTemplate: null } }, // queued signature
        },
      ],
    });

    let id: string | null = null;
    await act(async () => {
      id = await result.current.createTemplate({
        name: 'New',
        category: TemplateCategory.Weekly,
        items: [],
      });
    });
    expect(typeof id).toBe('string');
    expect(id).toBeTruthy();
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
        name: '',
        category: TemplateCategory.Weekly,
        items: [],
      });
    });
    expect(id).toBeNull();
  });

  it('updateTemplate writes the change optimistically and keeps it when queued', async () => {
    const cache = seedCache([TEMPLATE]);
    const { result } = renderHookWithApollo(() => useMealTemplateEditor(), {
      cache,
      operationMocks: [
        {
          request: {
            query: UpdateMealTemplateDocument,
            variables: () => true,
          },
          result: { data: { updateMealTemplate: null } }, // queued
        },
      ],
    });

    let ok: boolean | undefined;
    await act(async () => {
      const promise = result.current.updateTemplate('tpl-1', {
        name: 'Renamed',
      });
      expect(readTemplate(cache)?.name).toBe('Renamed');
      ok = await promise;
    });
    expect(ok).toBe(true);
    expect(readTemplate(cache)?.name).toBe('Renamed');
  });

  it('updateTemplate reverts and returns false on a rejection', async () => {
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
    await waitFor(() => {
      expect(readTemplate(cache)?.name).toBe('Weeknight Dinners');
    });
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
      ok = await result.current.addItem({
        templateId: 'tpl-1',
        dayOffset: 0,
        mealType: MealType.Breakfast,
        meal: { customMealName: 'Oats' },
        servings: 1,
      });
    });
    expect(ok).toBe(false);
  });
});
