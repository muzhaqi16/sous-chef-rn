import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { HapticService } from '#services/haptic/HapticService';
import { Chip } from '../Chip';

jest.mock('#services/haptic/HapticService', () => ({
  HapticService: { light: jest.fn() },
}));

beforeEach(() => jest.clearAllMocks());

describe('Chip', () => {
  it('says whether a filter chip is selected', () => {
    const { rerender } = render(
      <Chip label="Vegan" selected={false} onPress={jest.fn()} />,
    );
    expect(screen.getByRole('button', { name: 'Vegan' })).not.toBeSelected();

    rerender(<Chip label="Vegan" selected onPress={jest.fn()} />);

    expect(screen.getByRole('button', { name: 'Vegan' })).toBeSelected();
  });

  it('answers a press with a light haptic', () => {
    const onPress = jest.fn();
    render(<Chip label="Vegan" selected={false} onPress={onPress} />);

    fireEvent.press(screen.getByRole('button', { name: 'Vegan' }));

    expect(HapticService.light).toHaveBeenCalledTimes(1);
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does nothing while disabled', () => {
    const onPress = jest.fn();
    render(<Chip label="Vegan" selected={false} onPress={onPress} disabled />);

    fireEvent.press(screen.getByRole('button', { name: 'Vegan' }));

    expect(HapticService.light).not.toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('names what pressing a removable chip removes', () => {
    render(
      <Chip
        label="Gluten"
        removable
        accessibilityLabel="Remove Gluten"
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Remove Gluten' })).toBeTruthy();
  });
});
