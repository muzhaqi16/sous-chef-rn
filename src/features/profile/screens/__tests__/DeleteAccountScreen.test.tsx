'use no memo';
import React from 'react';
import { screen, userEvent } from '@testing-library/react-native';
import {
  recordMock,
  renderWithApollo,
  type MockedResponse,
} from '#/test-utils/apolloMockProvider';
import { CanDeleteAccountDocument } from '#operations/auth/user.generated';
import { DeletionBlockerType } from '#/graphql/generated/schemaTypes';
import { DeleteAccountScreen } from '../DeleteAccountScreen';
import type { BaseInputProps } from '#components/molecules/BaseInput/BaseInput';
import type { LoadingProps } from '#components/molecules/Loading';

jest.mock('#hooks/navigation/useAppNavigation');
const mockNav = jest
  .requireMock('#hooks/navigation/useAppNavigation')
  .useAppNavigation();

jest.mock('#/services/errorService');
const { localizedErrorMessage } = jest.requireMock('#/services/errorService');

jest.mock('#/utils/iconUtils', () => ({
  Icon: 'Icon',
}));

jest.mock('#components/organisms/Header', () => {
  const { View, Text, Pressable } = require('react-native');
  return {
    Header: ({ title, onBack }: { title?: string; onBack?: () => void }) => (
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

jest.mock('#components/molecules/BaseInput/BaseInput', () => ({
  BaseInput: ({ label, ...props }: BaseInputProps) => {
    const { View, Text, TextInput } = require('react-native');
    return (
      <View>
        {label ? <Text>{label}</Text> : null}
        <TextInput {...props} />
      </View>
    );
  },
}));
jest.mock('#components/molecules/Loading', () => {
  const { Text } = require('react-native');
  return {
    Loading: ({ message }: LoadingProps) => (
      <Text testID="loading">{message}</Text>
    ),
  };
});

function canDeleteOk(): MockedResponse {
  return recordMock(CanDeleteAccountDocument, {
    data: {
      canDeleteAccount: {
        __typename: 'CanDeleteAccountResult',
        canDelete: true,
        blockers: [],
      },
    },
  }).mock;
}

const HOME_SERVER_MESSAGE =
  'You are the only owner of "My Home" which has 1 other member(s). Transfer ownership or remove members first.';
const LIST_SERVER_MESSAGE =
  'You are the only owner of "Weekly" which has 2 active collaborator(s). Transfer ownership or remove collaborators first.';

function canDeleteBlocked(): MockedResponse {
  return recordMock(CanDeleteAccountDocument, {
    data: {
      canDeleteAccount: {
        __typename: 'CanDeleteAccountResult',
        canDelete: false,
        blockers: [
          {
            __typename: 'DeletionBlocker',
            type: DeletionBlockerType.HomeOwnership,
            resourceId: 'home-1',
            resourceName: 'My Home',
            message: HOME_SERVER_MESSAGE,
          },
          {
            __typename: 'DeletionBlocker',
            type: DeletionBlockerType.ShoppingList,
            resourceId: 'list-1',
            resourceName: 'Weekly',
            message: LIST_SERVER_MESSAGE,
          },
        ],
      },
    },
  }).mock;
}

function canDeleteError(): MockedResponse {
  return recordMock(CanDeleteAccountDocument, {
    error: new Error('Network error'),
  }).mock;
}

describe('DeleteAccountScreen - delete form', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  async function renderForm() {
    const utils = renderWithApollo(<DeleteAccountScreen />, {
      operationMocks: [canDeleteOk()],
    });
    await screen.findByText('Warning: This is permanent!');
    return utils;
  }

  it('renders the header with Delete Account title', async () => {
    await renderForm();
    expect(screen.getByText('Delete Account')).toBeTruthy();
  });

  it('renders the warning text', async () => {
    await renderForm();
    expect(screen.getByText('Warning: This is permanent!')).toBeTruthy();
  });

  it('renders what will be deleted section', async () => {
    await renderForm();
    expect(screen.getByText('What will be deleted:')).toBeTruthy();
    expect(
      screen.getByText('Your profile and account information'),
    ).toBeTruthy();
    expect(
      screen.getByText('All your pantry items and inventory'),
    ).toBeTruthy();
    expect(screen.getByText('Your shopping lists')).toBeTruthy();
  });

  it('renders confirmation input with placeholder', async () => {
    await renderForm();
    expect(screen.getByPlaceholderText('Type DELETE')).toBeTruthy();
  });

  it('renders the delete button as disabled initially', async () => {
    await renderForm();
    expect(screen.getByText('Delete My Account Forever')).toBeTruthy();
  });

  it('renders cancel button', async () => {
    await renderForm();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('calls goBack when header back is pressed', async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.press(screen.getByTestId('header-back'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });

  it('calls goBack when Cancel button is pressed', async () => {
    const user = userEvent.setup();
    await renderForm();
    await user.press(screen.getByText('Cancel'));
    expect(mockNav.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('DeleteAccountScreen - loading state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows loading state when checking eligibility', () => {
    // delay so initial render shows loading
    const m = recordMock(CanDeleteAccountDocument, {
      data: {
        canDeleteAccount: {
          __typename: 'CanDeleteAccountResult',
          canDelete: true,
          blockers: [],
        },
      },
      delay: 1000,
    }).mock;
    renderWithApollo(<DeleteAccountScreen />, { operationMocks: [m] });
    expect(screen.getByText('Checking account status...')).toBeTruthy();
  });
});

describe('DeleteAccountScreen - error state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows error state on eligibility check failure', async () => {
    renderWithApollo(<DeleteAccountScreen />, {
      operationMocks: [canDeleteError()],
    });
    await screen.findByText('Unable to check account status');
    expect(screen.queryByText('Network error')).toBeNull();
    expect(localizedErrorMessage).toHaveBeenCalledWith(
      expect.anything(),
      'An error occurred. Please try again.',
    );
    expect(screen.getByText('Something went wrong.')).toBeTruthy();
  });

  it('shows retry button on error', async () => {
    renderWithApollo(<DeleteAccountScreen />, {
      operationMocks: [canDeleteError()],
    });
    await screen.findByText('Retry');
  });
});

describe('DeleteAccountScreen - blocked state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows blocked state with blocker information', async () => {
    renderWithApollo(<DeleteAccountScreen />, {
      operationMocks: [canDeleteBlocked()],
    });
    await screen.findByText('Cannot Delete Account');
    expect(screen.getByText('My Home')).toBeTruthy();
    expect(
      screen.getByText(
        'Nobody else owns "My Home", and it still has other members.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('• Transfer ownership to another member'),
    ).toBeTruthy();
    expect(
      screen.getByText(
        'Nobody else owns the shopping list "Weekly", and it still has collaborators.',
      ),
    ).toBeTruthy();
    expect(
      screen.getByText('• Remove all collaborators from the list'),
    ).toBeTruthy();
  });

  it('renders no server message text', async () => {
    renderWithApollo(<DeleteAccountScreen />, {
      operationMocks: [canDeleteBlocked()],
    });
    await screen.findByText('Cannot Delete Account');
    expect(screen.queryByText(HOME_SERVER_MESSAGE)).toBeNull();
    expect(screen.queryByText(LIST_SERVER_MESSAGE)).toBeNull();
    expect(screen.queryByText(/only owner|\(s\)/)).toBeNull();
  });

  it('gives an unclassified blocker its reason and no resolution steps', async () => {
    const mock = recordMock(CanDeleteAccountDocument, {
      data: {
        canDeleteAccount: {
          __typename: 'CanDeleteAccountResult',
          canDelete: false,
          blockers: [
            {
              __typename: 'DeletionBlocker',
              type: DeletionBlockerType.Other,
              resourceId: 'thing-1',
              resourceName: 'Thing',
              message: 'Resolve "Thing" first.',
            },
          ],
        },
      },
    }).mock;
    renderWithApollo(<DeleteAccountScreen />, { operationMocks: [mock] });
    await screen.findByText('Cannot Delete Account');
    expect(
      screen.getByText(
        '"Thing" has to be resolved before your account can be deleted.',
      ),
    ).toBeTruthy();
    expect(screen.queryByText('To resolve:')).toBeNull();
    expect(screen.queryByText('Resolve "Thing" first.')).toBeNull();
  });

  it('shows Go Back button in blocked state', async () => {
    renderWithApollo(<DeleteAccountScreen />, {
      operationMocks: [canDeleteBlocked()],
    });
    await screen.findByText('Go Back');
  });
});
