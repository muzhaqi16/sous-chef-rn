import React, { useEffect, useRef } from 'react';
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { ToastProvider } from '../Toast';
import { useToast } from '../../../hooks/useToast';

// Mock the toastService to prevent initialization side effects
jest.mock('#/services/toastService', () => ({
  toastService: {
    init: jest.fn(),
  },
}));

// Helper component that triggers a toast once on mount
const ToastTrigger: React.FC<{
  message: string;
  type?: any;
  action?: { label: string; onPress: () => void };
}> = ({ message, type, action }) => {
  const showToast = useToast();
  const triggered = useRef(false);
  useEffect(() => {
    if (!triggered.current) {
      triggered.current = true;
      showToast({ message, type, action });
    }
  }, [message, type, action, showToast]);
  return <Text>Trigger</Text>;
};

describe('ToastProvider', () => {
  it('renders children', () => {
    render(
      <ToastProvider>
        <Text>Child Content</Text>
      </ToastProvider>,
    );
    expect(screen.getByText('Child Content')).toBeTruthy();
  });

  it('provides toast context to children', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Hello" />
      </ToastProvider>,
    );
    expect(screen.getByText('Trigger')).toBeTruthy();
  });

  it('displays toast message', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Toast message" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-message')).toBeTruthy();
    expect(screen.getByText('Toast message')).toBeTruthy();
  });

  it('displays toast with success type', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Saved!" type="success" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-success')).toBeTruthy();
  });

  it('displays toast with error type', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Failed!" type="error" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-error')).toBeTruthy();
  });

  it('renders toast with warning type without crashing', () => {
    render(
      <ToastProvider>
        <ToastTrigger message="Warning!" type="warning" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-warning')).toBeTruthy();
    expect(screen.getByText('Warning!')).toBeTruthy();
  });

  it('renders action button when action is provided', () => {
    const onPress = jest.fn();
    render(
      <ToastProvider>
        <ToastTrigger
          message="Failed!"
          type="error"
          action={{ label: 'Retry', onPress }}
        />
      </ToastProvider>,
    );
    expect(screen.getByText('Retry')).toBeTruthy();
  });
});
