'use no memo';
import React from 'react';
import { screen, act } from '@testing-library/react-native';
import CollaboratorPermissionsBottomSheet from '../CollaboratorPermissionsBottomSheet';
import { renderWithProviders } from '../../../../__tests__/helpers/renderWithProviders';

jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#components/atoms/BottomSheetHeader', () => ({
  BottomSheetHeader: ({
    title,
    cancelLabel,
    confirmLabel,
    onCancel,
    onConfirm,
    confirmDisabled,
  }: any) => {
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

jest.mock('#components/atoms/GlobalBottomSheetBackdrop', () => ({
  GlobalBottomSheetBackdrop: () => null,
}));

jest.mock('@apollo/client/react', () => ({
  ...jest.requireActual('@apollo/client/react'),
  useMutation: jest.fn((doc: any) => {
    const opName = doc?.definitions?.[0]?.name?.value;
    if (opName === 'UpdateCollaboratorRole')
      return [jest.fn(), { loading: false }];
    return [jest.fn(), {}];
  }),
}));

jest.mock('#/utils/compilerSafeWrappers');

describe('CollaboratorPermissionsBottomSheet', () => {
  const defaultProps = {
    shoppingListId: 'list-1',
    onSuccess: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders null when no collaborator is set', () => {
    const { toJSON } = renderWithProviders(
      <CollaboratorPermissionsBottomSheet {...defaultProps} />,
    );
    expect(toJSON()).toBeNull();
  });

  it('renders correctly with ref API', () => {
    const ref = React.createRef<any>();
    renderWithProviders(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    expect(ref.current).toBeTruthy();
    expect(ref.current.open).toBeDefined();
    expect(ref.current.close).toBeDefined();
  });

  it('opens and shows collaborator email after calling open', () => {
    const ref = React.createRef<any>();
    renderWithProviders(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    act(() => {
      ref.current.open({
        id: 'c-1',
        collaboratorId: 'collab-1',
        email: 'test@example.com',
        role: 'VIEWER',
        status: 'active',
      });
    });
    expect(screen.getByText('test@example.com')).toBeTruthy();
  });

  it('renders role options after opening', () => {
    const ref = React.createRef<any>();
    renderWithProviders(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    act(() => {
      ref.current.open({
        id: 'c-1',
        collaboratorId: 'collab-1',
        email: 'test@example.com',
        role: 'VIEWER',
        status: 'active',
      });
    });
    expect(screen.getByText('Viewer')).toBeTruthy();
    expect(screen.getByText('Shopper')).toBeTruthy();
    expect(screen.getByText('Editor')).toBeTruthy();
  });

  it('renders Update and Cancel in the header', () => {
    const ref = React.createRef<any>();
    renderWithProviders(
      <CollaboratorPermissionsBottomSheet {...defaultProps} ref={ref} />,
    );
    act(() => {
      ref.current.open({
        id: 'c-1',
        collaboratorId: 'collab-1',
        email: 'test@example.com',
        role: 'VIEWER',
        status: 'active',
      });
    });
    expect(screen.getByText('Update')).toBeTruthy();
    expect(screen.getByText('Cancel')).toBeTruthy();
  });
});
