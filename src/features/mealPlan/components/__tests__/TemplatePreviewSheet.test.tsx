'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import type { MealTemplateDisplayFragment } from '#features/mealPlan/graphql/mealPlanFragments.generated';
import {
  MembershipRole,
  TemplateCategory,
} from '#/graphql/generated/schemaTypes';
import { TemplatePreviewSheet } from '../TemplatePreviewSheet';

jest.mock('#hooks/useSharedBottomSheetConfigs', () => ({
  useSharedBottomSheetConfigs: () => ({ damping: 80, stiffness: 500 }),
}));

jest.mock('#components/molecules/FormInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    FormInput: ({
      label,
      value,
      onChangeText,
      placeholder,
    }: {
      label?: string;
      value?: string;
      onChangeText?: (text: string) => void;
      placeholder?: string;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          value,
          onChangeText,
          placeholder,
          testID: `form-input-${label?.replace(/\s+/g, '-').toLowerCase()}`,
        }),
      ),
  };
});

jest.mock('#components/molecules/DatePickerField', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    DatePickerField: ({ label }: { label?: string }) =>
      R.createElement(RN.View, null, R.createElement(RN.Text, null, label)),
  };
});

jest.mock('#components/molecules/EditableCounter', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    EditableCounter: ({
      label,
      value,
      onChangeText,
    }: {
      label?: string;
      value?: string;
      onChangeText?: (text: string) => void;
    }) =>
      R.createElement(
        RN.View,
        null,
        R.createElement(RN.Text, null, label),
        R.createElement(RN.TextInput, {
          value,
          onChangeText,
          testID: 'servings-input',
        }),
      ),
  };
});

jest.mock('#features/mealPlan/hooks/useMealTemplate', () => ({
  useMealTemplate: jest.fn(() => ({
    groupedByDay: [],
    loading: false,
  })),
}));

jest.mock('#utils/iconUtils', () => ({
  Icon: (props: { name: string }) => {
    const RN = require('react-native');
    return require('react').createElement(
      RN.Text,
      { testID: `icon-${props.name}` },
      props.name,
    );
  },
}));

describe('TemplatePreviewSheet', () => {
  const mockTemplate: MealTemplateDisplayFragment = {
    __typename: 'MealTemplate',
    id: 'tmpl-1',
    name: 'Weekly Healthy',
    description: 'A healthy weekly plan',
    category: TemplateCategory.Weekly,
    durationDays: 7,
    defaultServings: 4,
    tags: ['healthy'],
    usageCount: 3,
    lastUsedAt: null,
    homeId: 'home-1',
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
    home: {
      __typename: 'Home',
      id: 'home-1',
      name: 'My Home',
      myMembership: {
        __typename: 'Membership',
        id: 'mem-1',
        role: MembershipRole.Owner,
      },
    },
    user: { __typename: 'User', id: 'user-1' },
  };

  const defaultProps = {
    visible: true,
    template: mockTemplate,
    onClose: jest.fn(),
    onConfirm: jest.fn(),
    confirmLoading: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the template name', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Weekly Healthy')).toBeTruthy();
  });

  it('renders the template description when provided', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('A healthy weekly plan')).toBeTruthy();
  });

  it('renders the meta row with duration, servings, and home name', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('7 days · 4 servings · My Home')).toBeTruthy();
  });

  it('renders category text', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Weekly')).toBeTruthy();
  });

  it('renders Configuration section', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Configuration')).toBeTruthy();
  });

  it('renders Preview section', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Preview')).toBeTruthy();
  });

  it('renders Plan Name input', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Plan Name (optional)')).toBeTruthy();
  });

  it('renders Start Date picker', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Start Date')).toBeTruthy();
  });

  it('renders Servings counter', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Servings')).toBeTruthy();
  });

  it('renders Create Meal Plan button', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Create Meal Plan')).toBeTruthy();
  });

  it('returns null when template is null', () => {
    const { toJSON } = render(
      <TemplatePreviewSheet {...defaultProps} template={null} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders empty preview message when no meals', () => {
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('No meals in this template')).toBeTruthy();
  });

  it('renders loading indicator when template data is loading', () => {
    const {
      useMealTemplate,
    } = require('#features/mealPlan/hooks/useMealTemplate');
    useMealTemplate.mockReturnValueOnce({ groupedByDay: [], loading: true });
    render(<TemplatePreviewSheet {...defaultProps} />);
    // ActivityIndicator should be rendered (no "No meals" text)
    expect(screen.queryByText('No meals in this template')).toBeNull();
  });

  it('renders day-by-day preview when groupedByDay has items', () => {
    const {
      useMealTemplate,
    } = require('#features/mealPlan/hooks/useMealTemplate');
    useMealTemplate.mockReturnValueOnce({
      groupedByDay: [
        {
          dayOffset: 0,
          items: [
            {
              id: 'item-1',
              mealType: 'BREAKFAST',
              recipe: { name: 'Oatmeal' },
              customMealName: null,
            },
            {
              id: 'item-2',
              mealType: 'LUNCH',
              recipe: null,
              customMealName: 'Salad',
            },
          ],
        },
      ],
      loading: false,
    });
    render(<TemplatePreviewSheet {...defaultProps} />);
    expect(screen.getByText('Day 1')).toBeTruthy();
    expect(screen.getByText('Oatmeal')).toBeTruthy();
    expect(screen.getByText('Salad')).toBeTruthy();
    expect(screen.getByText('Breakfast')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
  });

  it('renders meta text without home name when home is null', () => {
    const templateNoHome = { ...mockTemplate, home: null };
    render(
      <TemplatePreviewSheet {...defaultProps} template={templateNoHome} />,
    );
    expect(screen.getByText('7 days · 4 servings')).toBeTruthy();
  });

  it('calls onConfirm when Create Meal Plan is pressed', async () => {
    const user = userEvent.setup();
    render(<TemplatePreviewSheet {...defaultProps} />);
    await user.press(screen.getByText('Create Meal Plan'));
    expect(defaultProps.onConfirm).toHaveBeenCalledWith(
      expect.objectContaining({
        templateId: 'tmpl-1',
        startDate: expect.any(String),
      }),
    );
  });
});
