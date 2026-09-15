import React from 'react';
import { act, render } from '@testing-library/react-native';
import type { MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import {
  MembershipRole,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import { TemplateSheets } from '../TemplateSheets';

interface PreviewProps {
  visible: boolean;
  template: MealTemplateDisplayFragment | null;
  onEdit?: (templateId: string) => void;
  onDelete?: (templateId: string) => void;
  onDuplicate?: (templateId: string, newName: string) => Promise<void>;
}

const previewRenders: PreviewProps[] = [];
const browserRenders: {
  onSelectTemplate: (template: MealTemplateDisplayFragment) => void;
}[] = [];

jest.mock('../TemplatePreviewSheet', () => ({
  TemplatePreviewSheet: (props: PreviewProps) => {
    previewRenders.push(props);
    return null;
  },
}));
jest.mock('../TemplateBrowserSheet', () => ({
  TemplateBrowserSheet: (props: (typeof browserRenders)[number]) => {
    browserRenders.push(props);
    return null;
  },
}));

const mockDeleteTemplate = jest.fn(async () => true);
const mockDuplicateTemplate = jest.fn(async () => ({ mealTemplateId: 'x' }));
jest.mock('#features/mealPlan/hooks/useMealTemplateActions', () => ({
  useMealTemplateActions: () => ({
    createPlanFromTemplate: jest.fn(),
    deleteTemplate: mockDeleteTemplate,
    duplicateTemplate: mockDuplicateTemplate,
    creatingFromTemplate: false,
    duplicating: false,
  }),
}));

const mockToBuilder = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ toMealTemplateBuilder: mockToBuilder }),
}));

jest.mock('#store/useAppStore', () => ({
  useUser: () => ({ id: 'user-1' }),
}));

const template = (
  overrides: Partial<MealTemplateDisplayFragment> = {},
): MealTemplateDisplayFragment => ({
  __typename: 'MealTemplate',
  id: 'tmpl-1',
  name: 'Weekly Healthy',
  description: null,
  category: TemplateCategory.Weekly,
  durationDays: 7,
  defaultServings: 2,
  tags: [],
  usageCount: 0,
  lastUsedAt: null,
  homeId: null,
  home: null,
  user: { __typename: 'User', id: 'user-1' },
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const lastPreview = () => {
  const props = previewRenders[previewRenders.length - 1];
  if (!props) throw new Error('the preview sheet never rendered');
  return props;
};

const openPreview = (selected: MealTemplateDisplayFragment) => {
  const browser = browserRenders[browserRenders.length - 1];
  if (!browser) throw new Error('the browser sheet never rendered');
  act(() => browser.onSelectTemplate(selected));
};

describe('TemplateSheets', () => {
  beforeEach(() => {
    previewRenders.length = 0;
    browserRenders.length = 0;
    jest.clearAllMocks();
  });

  it('offers edit, duplicate and delete on a template the user owns', () => {
    const onCloseBrowser = jest.fn();
    render(<TemplateSheets browserVisible onCloseBrowser={onCloseBrowser} />);
    openPreview(template());

    expect(onCloseBrowser).toHaveBeenCalled();
    const preview = lastPreview();
    expect(preview.visible).toBe(true);
    expect(preview.onEdit).toBeDefined();
    expect(preview.onDuplicate).toBeDefined();
    expect(preview.onDelete).toBeDefined();
  });

  it('offers only duplicate on a home template the user may only view', () => {
    render(<TemplateSheets browserVisible onCloseBrowser={jest.fn()} />);
    openPreview(
      template({
        homeId: 'home-1',
        user: { __typename: 'User', id: 'someone-else' },
        home: {
          __typename: 'Home',
          id: 'home-1',
          name: 'Family',
          myMembership: {
            __typename: 'Membership',
            id: 'mem-1',
            role: MembershipRole.Guest,
          },
        },
      }),
    );

    const preview = lastPreview();
    expect(preview.onEdit).toBeUndefined();
    expect(preview.onDelete).toBeUndefined();
    expect(preview.onDuplicate).toBeDefined();
  });

  it('closes the preview and opens the builder on edit', () => {
    render(
      <TemplateSheets browserVisible={false} onCloseBrowser={jest.fn()} />,
    );
    openPreview(template());

    act(() => lastPreview().onEdit?.('tmpl-1'));

    expect(mockToBuilder).toHaveBeenCalledWith({ templateId: 'tmpl-1' });
    expect(lastPreview().visible).toBe(false);
  });

  it('closes the preview before deleting the template it reads', () => {
    render(
      <TemplateSheets browserVisible={false} onCloseBrowser={jest.fn()} />,
    );
    openPreview(template());

    act(() => lastPreview().onDelete?.('tmpl-1'));

    expect(mockDeleteTemplate).toHaveBeenCalledWith('tmpl-1');
    expect(lastPreview().visible).toBe(false);
  });

  it('closes the preview once a duplicate settles', async () => {
    render(
      <TemplateSheets browserVisible={false} onCloseBrowser={jest.fn()} />,
    );
    openPreview(template());

    await act(async () => {
      await lastPreview().onDuplicate?.('tmpl-1', 'Spring Week');
    });

    expect(mockDuplicateTemplate).toHaveBeenCalledWith('tmpl-1', 'Spring Week');
    expect(lastPreview().visible).toBe(false);
  });
});
