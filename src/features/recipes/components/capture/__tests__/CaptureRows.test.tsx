import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { useRecipeCaptureStore } from '#features/recipes/store/recipeCaptureStore';
import { CaptureRows } from '../CaptureRows';

const mockToRecipeCreate = jest.fn();
jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: () => ({ toRecipeCreate: mockToRecipeCreate }),
}));

const add = (id: string, source: 'url' | 'photo', label: string | null) =>
  useRecipeCaptureStore.getState().addReading({
    id,
    source,
    label,
    createdAt: new Date().toISOString(),
  });

beforeEach(() => {
  jest.clearAllMocks();
  useRecipeCaptureStore.getState().reset();
});

describe('CaptureRows', () => {
  it('renders nothing with nothing captured', () => {
    render(<CaptureRows />);
    expect(screen.toJSON()).toBeNull();
  });

  it('names what each capture is reading', () => {
    add('c-1', 'url', 'example-cooking.com');
    add('c-2', 'photo', null);

    render(<CaptureRows />);

    expect(screen.getByText('Reading example-cooking.com…')).toBeTruthy();
    expect(screen.getByText('Reading your photos…')).toBeTruthy();
  });

  it('opens a partial read in the editor, and lets it go', () => {
    add('c-1', 'url', 'example-cooking.com');
    useRecipeCaptureStore.getState().markIncomplete('c-1');
    render(<CaptureRows />);

    fireEvent.press(
      screen.getByText('Finish the recipe from example-cooking.com'),
    );
    expect(mockToRecipeCreate).toHaveBeenCalledWith({ captureId: 'c-1' });

    fireEvent.press(screen.getByLabelText('Close'));
    expect(useRecipeCaptureStore.getState().entries).toEqual([]);
  });
});
