'use no memo';

import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { Row } from '../../../../src/components/organisms/ProfileInfo/Row';

jest.mock('../../../../src/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('../../../../src/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

describe('Row', () => {
  it('renders with label', () => {
    const { getByText } = render(<Row label="Email" />);
    expect(getByText('Email')).toBeTruthy();
  });

  it('renders label and value', () => {
    const { getByText } = render(<Row label="Email" value="test@example.com" />);
    expect(getByText('Email')).toBeTruthy();
    expect(getByText('test@example.com')).toBeTruthy();
  });

  it('calls onPress when pressed and no onSave', () => {
    const onPress = jest.fn();
    const { getByText } = render(<Row label="Email" onPress={onPress} />);
    fireEvent.press(getByText('Email'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('enters edit mode when onSave is provided and pressed', () => {
    const onSave = jest.fn();
    const { getByText, getByDisplayValue } = render(
      <Row label="Name" value="John" onSave={onSave} />,
    );
    fireEvent.press(getByText('Name'));
    expect(getByDisplayValue('John')).toBeTruthy();
  });

  it('renders leading icon when provided', () => {
    const { getByText } = render(
      <Row label="Settings" leadingIcon={<></>} />,
    );
    expect(getByText('Settings')).toBeTruthy();
  });
});
