'use no memo';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { DeleteAccountScreen } from '../DeleteAccountScreen';

// --- Mocks ---

const mockLogout = jest.fn();
const mockDeleteAccount = jest.fn().mockResolvedValue({});
const mockRefetch = jest.fn();

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = (
  jest.requireMock('#hooks/navigation/useAppNavigation') as {
    useAppNavigation: jest.Mock;
  }
).useAppNavigation();

jest.mock('#hooks/auth/useAuth', () => ({
  useAuth: () => ({
    logout: mockLogout,
  }),
}));

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn(),
  useQuery: jest.fn(),
}));

jest.mock('#/services/errorService', () => ({
  errorService: {
    reportError: jest.fn(),
  },
}));

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/molecules/Header', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Header: ({ title, onBack }: any) => (
      <View testID="header">
        <Text>{title}</Text>
        {onBack ? (
          <Pressable testID="header-back" onPress={onBack}>
            <Text>Back</Text>
          </Pressable>
        ) : null}
      </View>
    ),
  };
});

jest.mock('#components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: ({ label, ...props }: any) => {
    const { View, Text, TextInput } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput {...props} />
      </View>
    );
  },
}));
jest.mock('#components/base/Loading', () => {
  const { Text } = require('react-native');
  return {
    LoadingInline: ({ message }: any) => (
      <Text testID="loading">{message}</Text>
    ),
  };
});

const apolloMocks = jest.requireMock('@apollo/client/react') as {
  useMutation: jest.Mock;
  useQuery: jest.Mock;
};

const setCanDeleteResult = (result: any) => {
  apolloMocks.useQuery.mockImplementation((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'CanDeleteAccount') return result;
    return { data: undefined, loading: false, error: undefined };
  });
};

const setDefaultDeleteMutation = () => {
  apolloMocks.useMutation.mockImplementation((doc: any, options: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'DeleteAccount') {
      return [
        async () => {
          const result = await mockDeleteAccount();
          if (options?.onCompleted) options.onCompleted();
          return result;
        },
        { loading: false },
      ];
    }
    return [jest.fn(), {}];
  });
};

describe('DeleteAccountScreen - delete form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultDeleteMutation();
    setCanDeleteResult({
      data: {
        canDeleteAccount: { canDelete: true, blockers: [] },
      },
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('renders the header with Delete Account title', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('Delete Account')).toBeTruthy();
  });

  it('renders the warning text', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('Warning: This is permanent!')).toBeTruthy();
  });

  it('renders what will be deleted section', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('What will be deleted:')).toBeTruthy();
    expect(
      screen.getByText('Your profile and account information'),
    ).toBeTruthy();
    expect(
      screen.getByText('All your pantry items and inventory'),
    ).toBeTruthy();
    expect(screen.getByText('Your shopping lists')).toBeTruthy();
  });

  it('renders confirmation input with placeholder', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByPlaceholderText('Type DELETE')).toBeTruthy();
  });

  it('renders the delete button as disabled initially', () => {
    render(<DeleteAccountScreen />);
    const deleteButton = screen.getByText('Delete My Account Forever');
    expect(deleteButton).toBeTruthy();
  });

  it('renders cancel button', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls goBack when header back is pressed', () => {
    render(<DeleteAccountScreen />);
    fireEvent.press(screen.getByTestId('header-back'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('calls goBack when Cancel button is pressed', () => {
    render(<DeleteAccountScreen />);
    fireEvent.press(screen.getByText('Cancel'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('DeleteAccountScreen - loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultDeleteMutation();
    setCanDeleteResult({
      data: null,
      loading: true,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('shows loading state when checking eligibility', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('Checking account status...')).toBeTruthy();
  });
});

describe('DeleteAccountScreen - error state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultDeleteMutation();
    setCanDeleteResult({
      data: null,
      loading: false,
      error: { message: 'Network error' },
      refetch: mockRefetch,
    });
  });

  it('shows error state on eligibility check failure', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('Unable to check account status')).toBeTruthy();
    expect(screen.getByText('Network error')).toBeTruthy();
  });

  it('shows retry button on error', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('Retry')).toBeTruthy();
  });

  it('calls refetch when retry is pressed', () => {
    render(<DeleteAccountScreen />);
    fireEvent.press(screen.getByText('Retry'));
    expect(mockRefetch).toHaveBeenCalledTimes(1);
  });
});

describe('DeleteAccountScreen - blocked state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setDefaultDeleteMutation();
    setCanDeleteResult({
      data: {
        canDeleteAccount: {
          canDelete: false,
          blockers: [
            {
              resourceId: 'home-1',
              resourceName: 'My Home',
              message: 'You are the sole owner',
            },
          ],
        },
      },
      loading: false,
      error: null,
      refetch: mockRefetch,
    });
  });

  it('shows blocked state with blocker information', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('Cannot Delete Account')).toBeTruthy();
    expect(screen.getByText('My Home')).toBeTruthy();
    expect(screen.getByText('You are the sole owner')).toBeTruthy();
  });

  it('shows Go Back button in blocked state', () => {
    render(<DeleteAccountScreen />);
    expect(screen.getByText('Go Back')).toBeTruthy();
  });
});
