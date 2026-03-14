'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { HomeDetailScreen } from '../HomeDetailScreen';

jest.mock('../../../apollo/links/tokenScheduler');
jest.mock('../../../apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

const mockSaveName = jest.fn();
const mockChangeRole = jest.fn();
const mockRemoveMember = jest.fn();
const mockRevokeInvite = jest.fn();
const mockLeaveHome = jest.fn().mockResolvedValue(true);
const mockToggleJoinCode = jest.fn().mockResolvedValue(undefined);
const mockRefetch = jest.fn();
const mockHandleRoleSelect = jest.fn();
const mockCloseRolePicker = jest.fn();
const mockRolePickerState = {
  visible: false,
  membershipId: '',
  currentRole: '',
  memberName: '',
};

jest.mock('#hooks/home/useHomeDetailManagement', () => ({
  useHomeDetailManagement: jest.fn(() => ({
    home: {
      id: 'home-1',
      name: 'My Home',
      allowJoinCode: true,
      joinCode: 'ABC123',
      members: [
        { userId: 'user-1', role: 'OWNER', profile: { displayName: 'John' } },
        { userId: 'user-2', role: 'MEMBER', profile: { displayName: 'Jane' } },
      ],
      invites: [],
      myMembership: {
        id: 'membership-1',
        role: 'OWNER',
        status: 'ACTIVE',
        canManageHome: true,
      },
    },
    loading: false,
    leaving: false,
    refetch: mockRefetch,
    rolePickerState: mockRolePickerState,
    handleRoleSelect: mockHandleRoleSelect,
    closeRolePicker: mockCloseRolePicker,
    saveName: mockSaveName,
    changeRole: mockChangeRole,
    removeMember: mockRemoveMember,
    revokeInvite: mockRevokeInvite,
    leaveHome: mockLeaveHome,
    toggleJoinCode: mockToggleJoinCode,
  })),
  ROLE_OPTIONS: [
    { label: 'Owner', value: 'OWNER' },
    { label: 'Admin', value: 'ADMIN' },
    { label: 'Member', value: 'MEMBER' },
    { label: 'Guest', value: 'GUEST' },
  ],
}));

jest.mock('#store/useAppStore', () => ({
  useAppStore: jest.fn((selector: any) => selector({ user: { id: 'user-1' } })),
  selectUser: (s: any) => s.user,
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#/utils/compilerSafeWrappers');

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('#components/templates/DetailTemplate', () => ({
  DetailTemplate: ({ title, sections, onBack }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="detail-template">
        <Text>{title}</Text>
        <Pressable testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        {sections?.map((s: any, i: number) => (
          <View key={i} testID={`section-${i}`}>
            {s.title ? <Text>{s.title}</Text> : null}
            {s.content}
          </View>
        ))}
      </View>
    );
  },
}));

jest.mock('#components/molecules/EditableField', () => ({
  EditableField: ({ label, value }: any) => {
    const { View, Text } = require('react-native');
    return (
      <View testID="editable-field">
        <Text>
          {label}: {value}
        </Text>
      </View>
    );
  },
}));

jest.mock('#components/molecules/NavigationRow', () => ({
  NavigationRow: ({ title, onPress }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="nav-row" onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#components/organisms/home/HomeMembersSection', () => ({
  HomeMembersSection: () => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>Members Section</Text>
      </View>
    );
  },
}));

jest.mock('#components/settings/SettingSwitch', () => ({
  SettingSwitch: ({ title, value, onValueChange }: any) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        <Pressable
          testID="join-code-toggle"
          onPress={() => onValueChange(!value)}
        >
          <Text>{value ? 'On' : 'Off'}</Text>
        </Pressable>
      </View>
    );
  },
}));

jest.mock('#components/base/Button', () => ({
  Button: ({ title, onPress }: any) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID={`button-${title}`} onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#components/molecules/ModalPicker', () => ({
  ModalPicker: () => null,
}));

jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => null,
}));

jest.mock('#utils/iconUtils', () => ({
  Icon: () => null,
}));

jest.mock('#/services/alertService', () => ({
  alertService: { alert: jest.fn() },
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  const {
    useHomeDetailManagement,
  } = require('#hooks/home/useHomeDetailManagement');
  useHomeDetailManagement.mockReturnValue({
    home: {
      id: 'home-1',
      name: 'My Home',
      allowJoinCode: true,
      joinCode: 'ABC123',
      members: [
        { userId: 'user-1', role: 'OWNER', profile: { displayName: 'John' } },
        { userId: 'user-2', role: 'MEMBER', profile: { displayName: 'Jane' } },
      ],
      invites: [],
      myMembership: {
        id: 'membership-1',
        role: 'OWNER',
        status: 'ACTIVE',
        canManageHome: true,
      },
    },
    loading: false,
    leaving: false,
    refetch: mockRefetch,
    rolePickerState: mockRolePickerState,
    handleRoleSelect: mockHandleRoleSelect,
    closeRolePicker: mockCloseRolePicker,
    saveName: mockSaveName,
    changeRole: mockChangeRole,
    removeMember: mockRemoveMember,
    revokeInvite: mockRevokeInvite,
    leaveHome: mockLeaveHome,
    toggleJoinCode: mockToggleJoinCode,
  });

  const { useAppStore } = require('#store/useAppStore');
  useAppStore.mockImplementation((selector: any) =>
    selector({ user: { id: 'user-1' } }),
  );
});

describe('HomeDetailScreen', () => {
  const defaultProps = {
    route: { params: { homeId: 'home-1' } },
  };

  it('renders home detail template', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Home Details')).toBeTruthy();
  });

  it('shows home name in editable field', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Home Name: My Home')).toBeTruthy();
  });

  it('shows join code when enabled', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('ABC123')).toBeTruthy();
  });

  it('shows members section', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Members Section')).toBeTruthy();
  });

  it('shows storage locations navigation', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Storage Locations')).toBeTruthy();
  });

  it('does not show leave home for owner', () => {
    const { queryByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(queryByText('Leave Home')).toBeNull();
  });

  it('shows loading state when loading', () => {
    const {
      useHomeDetailManagement,
    } = require('#hooks/home/useHomeDetailManagement');
    useHomeDetailManagement.mockReturnValue({
      home: null,
      loading: true,
      leaving: false,
      refetch: mockRefetch,
      rolePickerState: mockRolePickerState,
      handleRoleSelect: mockHandleRoleSelect,
      closeRolePicker: mockCloseRolePicker,
      saveName: mockSaveName,
      changeRole: mockChangeRole,
      removeMember: mockRemoveMember,
      revokeInvite: mockRevokeInvite,
      leaveHome: mockLeaveHome,
      toggleJoinCode: mockToggleJoinCode,
    });

    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Home Details')).toBeTruthy();
  });

  it('shows leave home button for non-owner member', () => {
    const {
      useHomeDetailManagement,
    } = require('#hooks/home/useHomeDetailManagement');
    useHomeDetailManagement.mockReturnValue({
      home: {
        id: 'home-1',
        name: 'My Home',
        allowJoinCode: true,
        joinCode: 'ABC123',
        members: [
          { userId: 'user-1', role: 'OWNER', profile: { displayName: 'John' } },
          {
            userId: 'user-2',
            role: 'MEMBER',
            profile: { displayName: 'Jane' },
          },
        ],
        invites: [],
        myMembership: {
          id: 'membership-2',
          role: 'MEMBER',
          status: 'ACTIVE',
          canManageHome: false,
        },
      },
      loading: false,
      leaving: false,
      refetch: mockRefetch,
      rolePickerState: mockRolePickerState,
      handleRoleSelect: mockHandleRoleSelect,
      closeRolePicker: mockCloseRolePicker,
      saveName: mockSaveName,
      changeRole: mockChangeRole,
      removeMember: mockRemoveMember,
      revokeInvite: mockRevokeInvite,
      leaveHome: mockLeaveHome,
      toggleJoinCode: mockToggleJoinCode,
    });

    const { useAppStore } = require('#store/useAppStore');
    useAppStore.mockImplementation((selector: any) =>
      selector({ user: { id: 'user-2' } }),
    );

    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Leave Home')).toBeTruthy();
  });
});
