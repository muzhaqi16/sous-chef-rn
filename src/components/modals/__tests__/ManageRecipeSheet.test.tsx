import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { ManageRecipeSheet } from '../ManageRecipeSheet/ManageRecipeSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: null },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        textTertiary: '#999',
        primary: '#007AFF',
        primaryLight: '#E3F2FD',
        error: '#FF0000',
        surface: '#FFF',
        border: '#CCC',
        white: '#FFF',
        background: '#FFF',
      },
      spacing: { xs: 2, sm: 4, md: 8, lg: 16, xl: 24 },
    },
  })),
}));

jest.mock('#components/atoms/BottomSheetKeyboardAwareScrollView', () => {
  const RN = require('react-native');
  return {
    BottomSheetKeyboardAwareScrollView: (props: any) =>
      require('react').createElement(RN.View, props),
  };
});

jest.mock('#components/molecules/TagInput', () => {
  const RN = require('react-native');
  const R = require('react');
  return {
    TagInput: ({ tags, placeholder }: any) =>
      R.createElement(
        RN.View,
        { testID: 'tag-input' },
        R.createElement(RN.Text, null, placeholder),
        tags.map((tag: string) => R.createElement(RN.Text, { key: tag }, tag)),
      ),
  };
});

jest.mock('@react-native-vector-icons/ionicons', () => ({
  __esModule: true,
  default: 'Icon',
  Ionicons: 'Icon',
}));

describe('ManageRecipeSheet', () => {
  const defaultProps = {
    visible: true,
    onClose: jest.fn(),
    folders: ['Dinner', 'Lunch'],
    availableTags: ['quick', 'easy', 'healthy'],
    currentFolder: null as string | null,
    currentTags: [] as string[],
    currentNotes: null as string | null,
    currentRating: null as number | null,
    onUpdateFolder: jest.fn().mockResolvedValue(undefined),
    onUpdateTags: jest.fn().mockResolvedValue(undefined),
    onUpdateNotes: jest.fn().mockResolvedValue(undefined),
    onUpdateRating: jest.fn().mockResolvedValue(undefined),
    onRemove: jest.fn().mockResolvedValue(undefined),
    updating: false,
    recipeName: 'Pasta Carbonara',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Manage Recipe title', () => {
    render(<ManageRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Manage Recipe')).toBeTruthy();
  });

  it('displays the recipe name', () => {
    render(<ManageRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
  });

  it('renders Your Rating section', () => {
    render(<ManageRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Your Rating')).toBeTruthy();
  });

  it('renders Folder section with options', () => {
    render(<ManageRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Folder')).toBeTruthy();
    expect(screen.getByText('No Folder')).toBeTruthy();
    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
  });

  it('renders Tags section', () => {
    render(<ManageRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Tags')).toBeTruthy();
    expect(screen.getByTestId('tag-input')).toBeTruthy();
  });

  it('renders Notes section', () => {
    render(<ManageRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Notes')).toBeTruthy();
  });

  it('renders Create New Folder button', () => {
    render(<ManageRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Create New Folder')).toBeTruthy();
  });

  it('shows updating banner when updating is true', () => {
    render(<ManageRecipeSheet {...defaultProps} updating={true} />);
    expect(screen.getByText('Updating...')).toBeTruthy();
  });

  it('does not show updating banner when updating is false', () => {
    render(<ManageRecipeSheet {...defaultProps} updating={false} />);
    expect(screen.queryByText('Updating...')).toBeNull();
  });

  it('displays rating text when rating is provided', () => {
    render(<ManageRecipeSheet {...defaultProps} currentRating={3} />);
    expect(screen.getByText('3/5')).toBeTruthy();
  });

  it('does not show recipe name when not provided', () => {
    render(<ManageRecipeSheet {...defaultProps} recipeName={undefined} />);
    expect(screen.queryByText('Pasta Carbonara')).toBeNull();
  });
});
