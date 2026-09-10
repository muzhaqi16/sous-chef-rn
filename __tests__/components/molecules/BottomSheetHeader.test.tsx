'use no memo';

import React from 'react';
import { render, userEvent } from '@testing-library/react-native';
import { BottomSheetHeader } from '../../../src/components/molecules/BottomSheetHeader';

jest.mock('../../../src/apollo/links/tokenScheduler');
jest.mock('../../../src/apollo/links/refreshToken');

describe('BottomSheetHeader', () => {
  const defaultProps = {
    title: 'New Item',
    onCancel: jest.fn(),
    onConfirm: jest.fn(),
  };

  it('renders title', () => {
    const { getByText } = render(<BottomSheetHeader {...defaultProps} />);
    expect(getByText('New Item')).toBeTruthy();
  });

  it('renders default Cancel and Save labels', () => {
    const { getByText } = render(<BottomSheetHeader {...defaultProps} />);
    expect(getByText('Cancel')).toBeTruthy();
    expect(getByText('Save')).toBeTruthy();
  });

  it('calls onCancel when cancel pressed', async () => {
    const user = userEvent.setup();
    const onCancel = jest.fn();
    const { getByText } = render(
      <BottomSheetHeader {...defaultProps} onCancel={onCancel} />,
    );
    await user.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = jest.fn();
    const { getByText } = render(
      <BottomSheetHeader {...defaultProps} onConfirm={onConfirm} />,
    );
    await user.press(getByText('Save'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('renders custom labels', () => {
    const { getByText } = render(
      <BottomSheetHeader
        {...defaultProps}
        cancelLabel="Dismiss"
        confirmLabel="Create"
      />,
    );
    expect(getByText('Dismiss')).toBeTruthy();
    expect(getByText('Create')).toBeTruthy();
  });
});
