'use no memo';
import React from 'react';
import { screen, fireEvent } from '@testing-library/react-native';
import CollaboratorPermissionsBottomSheet from '#features/shoppingList/components/CollaboratorPermissionsBottomSheet';
import {
  CollaboratorRole,
  CollaboratorStatus,
} from '#graphql/generated/schemaTypes';
import type { ShoppingListCollaboratorFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UpdateCollaboratorPermissionsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

const makeCollaborator = (): ShoppingListCollaboratorFragment => ({
  __typename: 'ShoppingListCollaborator',
  id: 'c-1',
  collaboratorId: 'collab-1',
  email: 'test@example.com',
  role: CollaboratorRole.Editor,
  status: CollaboratorStatus.Active,
  canEdit: true,
  canAddItems: true,
  canRemoveItems: true,
  canEditItems: true,
  canMarkPurchased: true,
  canInviteOthers: false,
  invitedAt: '2024-01-01T00:00:00Z',
  collaborator: null,
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('CollaboratorPermissionsBottomSheet', () => {
  const defaultProps = {
    shoppingListId: 'list-1',
    collaborator: null,
    onDismiss: jest.fn(),
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows nothing with no collaborator to edit', () => {
    renderWithApollo(<CollaboratorPermissionsBottomSheet {...defaultProps} />);
    expect(screen.queryByText('test@example.com')).toBeNull();
  });

  it('opens and shows collaborator email after calling open', () => {
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet
        {...defaultProps}
        collaborator={makeCollaborator()}
      />,
    );
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders role options after opening', () => {
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet
        {...defaultProps}
        collaborator={makeCollaborator()}
      />,
    );
    expect(screen.getByText('Viewer')).toBeTruthy();
    expect(screen.getByText('Shopper')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
  });

  it('offers Update and close in the header', () => {
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet
        {...defaultProps}
        collaborator={makeCollaborator()}
      />,
    );
    expect(screen.getByLabelText('Update')).toBeTruthy();
    expect(screen.getByLabelText('Close')).toBeTruthy();
  });

  it('renders the granular permission toggles after opening', () => {
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet
        {...defaultProps}
        collaborator={makeCollaborator()}
      />,
    );
    expect(screen.getByText('Custom Permissions')).toBeTruthy();
    expect(screen.getByText('Can add items')).toBeTruthy();
    expect(screen.getByText('Can mark purchased')).toBeTruthy();
  });

  it('fires the permissions mutation when a toggle changes', async () => {
    const update = recordMock(UpdateCollaboratorPermissionsDocument, {
      held: true,
      data: {},
    });
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet
        {...defaultProps}
        collaborator={makeCollaborator()}
      />,
      { operationMocks: [update.mock] },
    );
    const switches = screen.getAllByRole('switch');
    fireEvent(switches[0]!, 'valueChange', false);
    await drainTimers();
    expect(update.fired).toHaveLength(1);
    // The answer is held: the switch flips before the mutation resolves.
    expect(switches[0]!.props.value).toBe(false);
  });
});
