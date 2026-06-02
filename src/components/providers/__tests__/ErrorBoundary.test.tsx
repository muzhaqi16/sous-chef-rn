import React from 'react';
import { render, screen, userEvent } from '@testing-library/react-native';
import { Text } from '#components/atoms/Text';
import ErrorBoundary, {
  NavigationErrorBoundary,
  AuthErrorBoundary,
  AppErrorBoundary,
  useErrorHandler,
} from '../ErrorBoundary';

// Mock Telemetry
jest.mock('#/services/telemetry', () => ({
  Telemetry: {
    trackError: jest.fn(),
    increment: jest.fn(),
  },
}));

// Suppress console.error for expected errors in tests
const originalConsoleError = console.error;
beforeAll(() => {
  console.error = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
});

// A component that throws an error on render
const ThrowingComponent: React.FC<{ message?: string }> = ({
  message = 'Test error',
}) => {
  throw new Error(message);
};

// A component that renders normally
const GoodComponent: React.FC = () => <Text>All good</Text>;

describe('ErrorBoundary', () => {
  it('renders children when there is no error', () => {
    render(
      <ErrorBoundary>
        <GoodComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('renders default fallback when a child throws', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });

  it('renders Try Again button in default fallback', () => {
    render(
      <ErrorBoundary>
        <ThrowingComponent />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Try Again')).toBeTruthy();
  });

  it('renders custom fallback when provided', () => {
    render(
      <ErrorBoundary fallback={error => <Text>Custom: {error.message}</Text>}>
        <ThrowingComponent message="oops" />
      </ErrorBoundary>,
    );
    expect(screen.getByText('Custom: oops')).toBeTruthy();
  });

  it('calls onError when a child throws', () => {
    const onError = jest.fn();
    render(
      <ErrorBoundary onError={onError}>
        <ThrowingComponent message="error callback" />
      </ErrorBoundary>,
    );
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'error callback' }),
      expect.objectContaining({ componentStack: expect.any(String) }),
    );
  });

  it('recovers after pressing Try Again', async () => {
    const user = userEvent.setup();
    let shouldThrow = true;
    const ConditionalThrow: React.FC = () => {
      if (shouldThrow) {
        throw new Error('conditional error');
      }
      return <Text>Recovered</Text>;
    };

    render(
      <ErrorBoundary>
        <ConditionalThrow />
      </ErrorBoundary>,
    );

    expect(screen.getByText('Something went wrong')).toBeTruthy();

    shouldThrow = false;
    await user.press(screen.getByText('Try Again'));

    expect(screen.getByText('Recovered')).toBeTruthy();
  });
});

describe('NavigationErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <NavigationErrorBoundary>
        <GoodComponent />
      </NavigationErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('catches errors and shows fallback', () => {
    render(
      <NavigationErrorBoundary>
        <ThrowingComponent />
      </NavigationErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});

describe('AuthErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <AuthErrorBoundary>
        <GoodComponent />
      </AuthErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('catches errors and shows fallback', () => {
    render(
      <AuthErrorBoundary>
        <ThrowingComponent />
      </AuthErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});

describe('AppErrorBoundary', () => {
  it('renders children when no error', () => {
    render(
      <AppErrorBoundary>
        <GoodComponent />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('All good')).toBeTruthy();
  });

  it('catches errors and shows default fallback', () => {
    render(
      <AppErrorBoundary>
        <ThrowingComponent />
      </AppErrorBoundary>,
    );
    expect(screen.getByText('Something went wrong')).toBeTruthy();
  });
});

describe('useErrorHandler', () => {
  it('returns a function', () => {
    const TestComponent: React.FC = () => {
      const handleError = useErrorHandler();
      return (
        <Text>
          {typeof handleError === 'function' ? 'is function' : 'not function'}
        </Text>
      );
    };
    render(<TestComponent />);
    expect(screen.getByText('is function')).toBeTruthy();
  });
});
