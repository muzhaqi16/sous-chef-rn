'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { BottomSheetHeader } from '../../../src/components/atoms/BottomSheetHeader';

jest.mock('../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

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

  it('calls onCancel when cancel pressed', () => {
    const onCancel = jest.fn();
    const { getByText } = render(
      <BottomSheetHeader {...defaultProps} onCancel={onCancel} />,
    );
    fireEvent.press(getByText('Cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('calls onConfirm when confirm pressed', () => {
    const onConfirm = jest.fn();
    const { getByText } = render(
      <BottomSheetHeader {...defaultProps} onConfirm={onConfirm} />,
    );
    fireEvent.press(getByText('Save'));
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
