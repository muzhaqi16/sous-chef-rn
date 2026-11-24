import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { lightTheme } from '#/theme/themes';
import { SheetHeader } from '#components/templates/SheetHeader';
import { kitTestIDs } from '#components/testIDs';

describe('SheetHeader', () => {
  // Every form sheet's body starts clear of the divider without a spacer of its own.
  it('leaves the gap between its divider and the sheet body', () => {
    render(<SheetHeader title="Import from a link" onClose={jest.fn()} />);

    expect(screen.root).toHaveStyle({ marginBottom: lightTheme.spacing.md });
  });

  it('leaves no gap without a divider', () => {
    render(<SheetHeader title="Search" onClose={jest.fn()} borderless />);

    expect(screen.root).not.toHaveStyle({
      marginBottom: lightTheme.spacing.md,
    });
  });

  it('leads with close, under the id a sheet gives it', async () => {
    const onClose = jest.fn();
    render(
      <SheetHeader
        title="Add item"
        onClose={onClose}
        leadingTestID="add-cancel"
        titleTestID="add-title"
      />,
    );

    expect(screen.queryByTestId(kitTestIDs.headerBackButton)).toBeNull();
    expect(screen.getByTestId('add-title')).toHaveTextContent('Add item');
    await userEvent.setup().press(screen.getByTestId('add-cancel'));
    expect(onClose).toHaveBeenCalled();
  });

  // A step inside one sheet goes back to the step before, not out of the sheet.
  it('leads with back for a step', async () => {
    const onClose = jest.fn();
    render(<SheetHeader title="Report" onClose={onClose} leading="back" />);

    expect(screen.queryByTestId(kitTestIDs.headerCloseButton)).toBeNull();
    await userEvent
      .setup()
      .press(screen.getByTestId(kitTestIDs.headerBackButton));
    expect(onClose).toHaveBeenCalled();
  });
});
