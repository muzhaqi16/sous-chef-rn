import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MonthCalendar } from '../MonthCalendar';

// The calendar hides its header's arrows and title from screen readers.
const hidden = { includeHiddenElements: true };

let mockThemeEpoch = 0;
jest.mock('#hooks/ui/useThemeEpoch', () => ({
  useThemeEpoch: () => mockThemeEpoch,
}));

describe('MonthCalendar', () => {
  it('stays on the month paged to when a theme change remounts it', () => {
    const props = {
      selectedDate: new Date(2026, 9, 22),
      onSelectDate: jest.fn(),
      testID: 'calendar',
    };
    const { rerender } = render(<MonthCalendar {...props} />);
    const nextMonth = () =>
      fireEvent.press(screen.getByTestId('calendar.header.rightArrow', hidden));
    nextMonth();
    nextMonth();
    expect(screen.getByText('December 2026', hidden)).toBeTruthy();

    mockThemeEpoch += 1;
    rerender(<MonthCalendar {...props} />);

    expect(screen.getByText('December 2026', hidden)).toBeTruthy();
  });
});
