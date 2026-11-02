'use no memo';
import React from 'react';
import { screen, act, fireEvent } from '@testing-library/react-native';
import CollaboratorPermissionsBottomSheet, {
  type CollaboratorPermissionsBottomSheetRef,
} from '#features/shoppingList/components/CollaboratorPermissionsBottomSheet';
import {
  CollaboratorRole,
  CollaboratorStatus,
} from '#/graphql/generated/schemaTypes';
import type { ShoppingListCollaboratorFragment } from '#features/shoppingList/graphql/shoppingListFragments.generated';
import { UpdateCollaboratorPermissionsDocument } from '#features/shoppingList/graphql/shoppingList.generated';
import { recordMock, renderWithApollo } from '#/test-utils/apolloMockProvider';
import { drainTimers } from '#/test-utils/drainTimers';

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

jest.mock('#components/molecules/BottomSheetHeader', () => ({
  BottomSheetHeader: ({
    title,
    cancelLabel,
    confirmLabel,
    onCancel,
    onConfirm,
    confirmDisabled,
  }: {
    title: string;
    cancelLabel?: string;
    confirmLabel?: string;
    onCancel: () => void;
    onConfirm: () => void;
    confirmDisabled?: boolean;
  }) => {
    const RN = require('react-native');
    const R = require('react');
    return R.createElement(
      RN.View,
      null,
      R.createElement(
        RN.Pressable,
        { onPress: onCancel },
        R.createElement(RN.Text, null, cancelLabel ?? 'Cancel'),
      ),
      R.createElement(RN.Text, null, title),
      R.createElement(
        RN.Pressable,
        { onPress: onConfirm, disabled: confirmDisabled },
        R.createElement(RN.Text, null, confirmLabel ?? 'Save'),
      ),
    );
  },
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
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null when no collaborator is set', () => {
    const { toJSON } = renderWithApollo(
      <CollaboratorPermissionsBottomSheet {...defaultProps} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders correctly with ref API', () => {
    const ref = React.createRef<CollaboratorPermissionsBottomSheetRef>();
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    expect(ref.current).toBeTruthy();
    expect(ref.current?.open).toBeDefined();
    expect(ref.current?.close).toBeDefined();
  });

  it('opens and shows collaborator email after calling open', () => {
    const ref = React.createRef<CollaboratorPermissionsBottomSheetRef>();
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    act(() => {
      ref.current?.open(makeCollaborator());
    });
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders role options after opening', () => {
    const ref = React.createRef<CollaboratorPermissionsBottomSheetRef>();
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    act(() => {
      ref.current?.open(makeCollaborator());
    });
    expect(screen.getByText('Viewer')).toBeTruthy();
    expect(screen.getByText('Shopper')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
  });

  it('renders Update and Cancel in the header', () => {
    const ref = React.createRef<CollaboratorPermissionsBottomSheetRef>();
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    act(() => {
      ref.current?.open(makeCollaborator());
    });
    expect(screen.getByText('Update')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });

  it('renders the granular permission toggles after opening', () => {
    const ref = React.createRef<CollaboratorPermissionsBottomSheetRef>();
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    act(() => {
      ref.current?.open(makeCollaborator());
    });
    expect(screen.getByText('Custom Permissions')).toBeTruthy();
    expect(screen.getByText('Can add items')).toBeTruthy();
    expect(screen.getByText('Can mark purchased')).toBeTruthy();
  });

  it('fires the permissions mutation when a toggle changes', async () => {
    const ref = React.createRef<CollaboratorPermissionsBottomSheetRef>();
    const update = recordMock(UpdateCollaboratorPermissionsDocument, {
      held: true,
      data: {},
    });
    renderWithApollo(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
      { operationMocks: [update.mock] },
    );
    act(() => {
      ref.current?.open(makeCollaborator());
    });
    const switches = screen.getAllByRole('switch');
    fireEvent(switches[0]!, 'valueChange', false);
    await drainTimers();
    expect(update.fired).toHaveLength(1);
    // The answer is held: the switch flips before the mutation resolves.
    expect(switches[0]!.props.value).toBe(false);
  });
});
