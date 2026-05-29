'use no memo';
import React from 'react';
import {
  fireEvent,
  render,
  screen,
  userEvent,
} from '@testing-library/react-native';
import { StorageLocationForm } from '../StorageLocationForm';

describe('StorageLocationForm', () => {
  const defaultProps = {
    onSubmit: jest.fn(),
    onCancel: jest.fn(),
    isSubmitting: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders Name input field', () => {
    render(<StorageLocationForm {...defaultProps} />);
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByPlaceholderText('e.g., Main Refrigerator')).toBeTruthy();
  });

  it('renders Type selector', () => {
    render(<StorageLocationForm {...defaultProps} />);
    expect(screen.getByText('Type')).toBeTruthy();
  });

  it('renders storage type buttons', () => {
    render(<StorageLocationForm {...defaultProps} />);
    expect(screen.getByText('Refrigerator')).toBeTruthy();
    expect(screen.getByText('Freezer')).toBeTruthy();
    expect(screen.getByText('Pantry Shelf')).toBeTruthy();
    expect(screen.getByText('Cabinet')).toBeTruthy();
  });

  it('renders Create button when no initialData', () => {
    render(<StorageLocationForm {...defaultProps} />);
    expect(screen.getByText('Create')).toBeTruthy();
  });

  it('renders Update button when initialData is provided', () => {
    render(
      <StorageLocationForm
        {...defaultProps}
        initialData={{
          name: 'My Fridge',
          type: 'REFRIGERATOR',
        }}
      />,
    );
    expect(screen.getByText('Update')).toBeTruthy();
  });

  it('renders Cancel button', () => {
    render(<StorageLocationForm {...defaultProps} />);
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls onCancel when Cancel button is pressed', async () => {
    const user = userEvent.setup();
    render(<StorageLocationForm {...defaultProps} />);
    await user.press(screen.getByText('Cancel'));
    expect(defaultProps.onCancel).toHaveBeenCalled();
  });

  it('pre-fills form data from initialData', () => {
    render(
      <StorageLocationForm
        {...defaultProps}
        initialData={{
          name: 'Kitchen Fridge',
          type: 'REFRIGERATOR',
        }}
      />,
    );
    expect(screen.getByDisplayValue('Kitchen Fridge')).toBeTruthy();
  });

  it('hides action buttons when hideActions is true', () => {
    render(<StorageLocationForm {...defaultProps} hideActions={true} />);
    expect(screen.queryByText('Create')).toBeNull();
    expect(screen.queryByText('Cancel')).toBeNull();
  });

  it('renders parent location selector when availableLocations has entries', () => {
    render(
      <StorageLocationForm
        {...defaultProps}
        availableLocations={[
          { id: 'loc-1', name: 'Main Fridge', type: 'REFRIGERATOR' },
          { id: 'loc-2', name: 'Pantry', type: 'PANTRY_SHELF' },
        ]}
      />,
    );
    expect(screen.getByText('Parent Location (Optional)')).toBeTruthy();
    expect(screen.getAllByText('None').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Main Fridge')).toBeTruthy();
    expect(screen.getByText('Pantry')).toBeTruthy();
  });

  it('does not render parent location selector when availableLocations is empty', () => {
    render(<StorageLocationForm {...defaultProps} availableLocations={[]} />);
    expect(screen.queryByText('Parent Location (Optional)')).toBeNull();
  });

  it('allows typing in the name field', () => {
    render(<StorageLocationForm {...defaultProps} />);
    const nameInput = screen.getByPlaceholderText('e.g., Main Refrigerator');
    fireEvent.changeText(nameInput, 'Garage Shelf');
    expect(screen.getByDisplayValue('Garage Shelf')).toBeTruthy();
  });

  it('calls onSubmit with form data when Create is pressed', async () => {
    const user = userEvent.setup();
    render(<StorageLocationForm {...defaultProps} />);
    const nameInput = screen.getByPlaceholderText('e.g., Main Refrigerator');
    fireEvent.changeText(nameInput, 'Test Location');
    await user.press(screen.getByText('Create'));
    expect(defaultProps.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Test Location',
        type: 'PANTRY_SHELF',
      }),
    );
  });

  it('does not call onSubmit when name is empty', async () => {
    const user = userEvent.setup();
    render(<StorageLocationForm {...defaultProps} />);
    await user.press(screen.getByText('Create'));
    expect(defaultProps.onSubmit).not.toHaveBeenCalled();
  });
});
