import React from 'react';
import { render, screen } from '@testing-library/react-native';
import ErrorMessage from '../ErrorMessage';

describe('ErrorMessage', () => {
  it('renders the error message text', () => {
    render(<ErrorMessage message="Something went wrong" />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('renders different messages', () => {
    render(<ErrorMessage message="Network error" />);
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('renders without crashing', () => {
    const { toJSON } = render(<ErrorMessage message="Error" />);
    expect(toJSON()).toBeTruthy();
  });

  it('renders empty string message', () => {
    const { toJSON } = render(<ErrorMessage message="" />);
    expect(toJSON()).toBeTruthy();
  });
});
