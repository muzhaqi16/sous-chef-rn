'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { TemplateBrowserSheet } from '../../../src/features/mealPlan/components/TemplateBrowserSheet';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

jest.mock('../../../src/hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: () => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        textTertiary: '#999',
        primary: '#007AFF',
        border: '#ddd',
        surface: '#fff',
      },
    },
  }),
  BottomSheetModal: ({ children }: { children: React.ReactNode }) => children,
}));
jest.mock('../../../src/features/mealPlan/hooks/useMealTemplates', () => ({
  useMealTemplates: () => ({
    state: {
      templates: [],
      loading: false,
      error: undefined,
      // A response arrived — separates an empty result from a fetch that
      // never answered, which must not render the same way.
      hasResult: true,
      hasMore: false,
      totalCount: 0,
      searchQuery: '',
      selectedCategory: undefined,
    },
    actions: {
      refetch: jest.fn(),
      loadMore: jest.fn(),
      setSearchQuery: jest.fn(),
      setSelectedCategory: jest.fn(),
    },
  }),
}));
jest.mock('../../../src/features/mealPlan/components/TemplateCard', () => ({
  TemplateCard: () => null,
}));
jest.mock('../../../src/components/atoms/ChipScrollRow', () => ({
  ChipScrollRow: () => null,
}));

describe('TemplateBrowserSheet', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    onSelectTemplate: jest.fn(),
  };

  it('renders without crashing', () => {
    const { toJSON } = render(<TemplateBrowserSheet {...defaultProps} />);
    expect(toJSON()).toBeTruthy();
  });

  it('shows Browse Templates title', () => {
    const { getByText } = render(<TemplateBrowserSheet {...defaultProps} />);
    expect(getByText('Browse Templates')).toBeTruthy();
  });

  it('shows empty state when no templates', () => {
    const { getByText } = render(<TemplateBrowserSheet {...defaultProps} />);
    expect(getByText('No templates found')).toBeTruthy();
  });

  it('renders search input placeholder', () => {
    const { getByPlaceholderText } = render(
      <TemplateBrowserSheet {...defaultProps} />,
    );
    expect(getByPlaceholderText('Search templates...')).toBeTruthy();
  });
});
