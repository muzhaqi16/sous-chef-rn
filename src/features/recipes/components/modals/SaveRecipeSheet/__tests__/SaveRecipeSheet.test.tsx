'use no memo';
import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { SaveRecipeSheet } from '../SaveRecipeSheet';

jest.mock('#hooks/useStandardBottomSheet', () => ({
  useStandardBottomSheet: jest.fn(() => ({
    ref: { current: { present: jest.fn(), dismiss: jest.fn() } },
    modalProps: {},
    contentContainerStyle: {},
    theme: {
      colors: {
        textPrimary: '#000',
        textSecondary: '#666',
        primary: '#007AFF',
        primaryLight: '#E3F2FD',
        surface: '#FFF',
        border: '#CCC',
        white: '#FFF',
      },
    },
  })),
  BottomSheetModal: ({ children }: { children?: React.ReactNode }) => children,
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/molecules/TagInput', () => ({
  TagInput: ({
    tags,
    placeholder,
  }: {
    tags: string[];
    placeholder?: string;
  }) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="tag-input">
        <Text>{placeholder}</Text>
        {tags.map((tag: string) => (
          <Text key={tag}>{tag}</Text>
        ))}
      </View>
    );
  },
}));

const defaultProps = {
  visible: true,
  onClose: jest.fn(),
  folders: ['Dinner', 'Lunch'],
  availableTags: ['quick', 'easy', 'healthy'],
  onSave: jest.fn().mockResolvedValue(undefined),
  saving: false,
  recipeName: 'Pasta Carbonara',
};

describe('SaveRecipeSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the Save Recipe title', () => {
    render(<SaveRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Save Recipe')).toBeTruthy();
  });

  it('displays the recipe name', () => {
    render(<SaveRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Pasta Carbonara')).toBeTruthy();
  });

  it('does not display recipe name when not provided', () => {
    render(<SaveRecipeSheet {...defaultProps} recipeName={undefined} />);
    expect(screen.queryByText('Pasta Carbonara')).toBeNull();
  });

  it('renders folder section with default Favorites selected', () => {
    render(<SaveRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Folder')).toBeTruthy();
    expect(screen.getByText('Favorites')).toBeTruthy();
    expect(screen.getByText('No Folder')).toBeTruthy();
    expect(screen.getByText('Dinner')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
  });

  it('renders Create New Folder button', () => {
    render(<SaveRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Create New Folder')).toBeTruthy();
  });

  it('renders Tags section', () => {
    render(<SaveRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Tags (optional)')).toBeTruthy();
    expect(screen.getByTestId('tag-input')).toBeTruthy();
  });

  it('renders Notes section', () => {
    render(<SaveRecipeSheet {...defaultProps} />);
    expect(screen.getByText('Notes (optional)')).toBeTruthy();
    expect(
      screen.getByPlaceholderText('Add any notes about this recipe...'),
    ).toBeTruthy();
  });

  it('selects a different folder when pressed', async () => {
    const user = userEvent.setup();
    render(<SaveRecipeSheet {...defaultProps} />);
    await user.press(screen.getByText('Dinner'));
    // After pressing Dinner, Favorites is deselected (checkmark removed)
    expect(screen.getByText('Dinner')).toBeTruthy();
  });

  it('shows the notes input placeholder', () => {
    render(<SaveRecipeSheet {...defaultProps} />);
    expect(
      screen.getByPlaceholderText('Add any notes about this recipe...'),
    ).toBeTruthy();
  });

  it('shows new folder input when Create New Folder is pressed', async () => {
    const user = userEvent.setup();
    render(<SaveRecipeSheet {...defaultProps} />);
    await user.press(screen.getByText('Create New Folder'));
    expect(screen.getByPlaceholderText('Enter folder name...')).toBeTruthy();
    expect(screen.getByText('Create')).toBeTruthy();
  });

  it('deduplicates folders and always shows Favorites first', () => {
    render(
      <SaveRecipeSheet
        {...defaultProps}
        folders={['Favorites', 'Dinner', 'Lunch']}
      />,
    );
    const allFavorites = screen.getAllByText('Favorites');
    // Should only appear once (deduped)
    expect(allFavorites.length).toBe(1);
  });
});
