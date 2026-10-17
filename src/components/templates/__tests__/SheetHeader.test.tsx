import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { lightTheme } from '#/theme/themes';
import { SheetHeader } from '#components/templates/SheetHeader';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

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
});
