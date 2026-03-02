import React, {useEffect} from 'react';
import { render, screen } from '@testing-library/react-native';
import { Platform, Text } from 'react-native';
import { ToastProvider } from '../Toast';
import { useToast } from '../../../hooks/useToast';

// Mock the toastService to prevent initialization side effects
jest.mock('#/services/toastService', () => ({
  toastService: {
    init: jest.fn(),
  },
}));

// Helper component that triggers a toast
const ToastTrigger: React.FC<{ message: string; type?: any }> = ({ message, type }) => {
  const showToast = useToast();
 useEffect(() => {
    showToast({ message, type });
  }, [message, type, showToast]);
  return <Text>Trigger</Text>;
};

describe('ToastProvider', () => {
  const originalPlatform = Platform.OS;

  afterEach(() => {
    Object.defineProperty(Platform, 'OS', { value: originalPlatform });
  });

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

  it('displays toast message on iOS', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    render(
      <ToastProvider>
        <ToastTrigger message="Toast message" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-message')).toBeTruthy();
    expect(screen.getByText('Toast message')).toBeTruthy();
  });

  it('displays toast with success type on iOS', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    render(
      <ToastProvider>
        <ToastTrigger message="Saved!" type="success" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-success')).toBeTruthy();
  });

  it('displays toast with error type on iOS', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    render(
      <ToastProvider>
        <ToastTrigger message="Failed!" type="error" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-error')).toBeTruthy();
  });

  it('renders multiple toast types on iOS without crashing', () => {
    Object.defineProperty(Platform, 'OS', { value: 'ios' });
    render(
      <ToastProvider>
        <ToastTrigger message="Warning!" type="warning" />
      </ToastProvider>,
    );
    expect(screen.getByTestId('toast-warning')).toBeTruthy();
    expect(screen.getByText('Warning!')).toBeTruthy();
  });
});
