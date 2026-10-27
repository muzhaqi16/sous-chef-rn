'use no memo';

import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import type { RootState } from '#store/index';
import { useAppNavigation } from '#hooks/navigation/useAppNavigation';
import { HomeDetailScreen } from '../HomeDetailScreen';

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

jest.mock('#features/home/screens/useHomeDetailManagement', () => ({
  useHomeDetailManagement: jest.fn(() => ({
    home: {
      id: 'home-1',
      name: 'My Home',
      allowJoinCode: true,
      joinCode: 'ABC123',
      membersConnection: { edges: [], totalCount: 0 },
      invitesConnection: { edges: [], totalCount: 0 },
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
  useAppStore: jest.fn(
    <T,>(selector: (state: RootState) => T): T =>
      selector({ user: { id: 'user-1' } } as Partial<RootState> as RootState),
  ),
  useUser: jest.fn(() => ({ id: 'user-1' })),
}));

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('@react-native-clipboard/clipboard', () => ({
  setString: jest.fn(),
}));

jest.mock('#components/templates/DetailTemplate', () => ({
  DetailTemplate: ({
    title,
    sections,
    onBack,
  }: {
    title?: string;
    sections: { title?: string; content: React.ReactNode }[];
    onBack: () => void;
  }) => {
    const { View, Text, Pressable } = require('react-native');
    return (
      <View testID="detail-template">
        <Text>{title}</Text>
        <Pressable testID="back-button" onPress={onBack}>
          <Text>Back</Text>
        </Pressable>
        {sections?.map((s, i: number) => (
          <View key={i} testID={`section-${i}`}>
            {s.title ? <Text>{s.title}</Text> : null}
            {s.content}
          </View>
        ))}
      </View>
    );
  },
}));

// Captures each field's props so a test can run the screen's own check.
interface EditableFieldProps {
  label: string;
  value: string;
  validation?: (value: string) => string | null;
}
const mockEditableFieldProps: EditableFieldProps[] = [];
jest.mock('#features/home/components/EditableField', () => ({
  EditableField: (props: EditableFieldProps) => {
    mockEditableFieldProps.push(props);
    const { label, value } = props;
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

jest.mock('#features/home/components/NavigationRow', () => ({
  NavigationRow: ({
    title,
    onPress,
  }: {
    title: string;
    onPress: () => void;
  }) => {
    const { Pressable, Text } = require('react-native');
    return (
      <Pressable testID="nav-row" onPress={onPress}>
        <Text>{title}</Text>
      </Pressable>
    );
  },
}));

jest.mock('#features/home/components/HomeMembersSection', () => ({
  HomeMembersSection: () => {
    const { View, Text } = require('react-native');
    return (
      <View>
        <Text>Members Section</Text>
      </View>
    );
  },
}));

jest.mock('#components/molecules/SettingSwitch', () => ({
  SettingSwitch: ({
    title,
    value,
    onValueChange,
  }: {
    title: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
  }) => {
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

jest.mock('#components/molecules/Button', () => ({
  Button: ({ title, onPress }: { title?: string; onPress?: () => void }) => {
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

jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => null,
}));

jest.mock('#components/atoms/Icon', () => ({
  Icon: () => null,
}));

beforeEach(() => {
  jest.clearAllMocks();
  // Restore default mock implementations after clearAllMocks
  const {
    useHomeDetailManagement,
  } = require('#features/home/screens/useHomeDetailManagement');
  useHomeDetailManagement.mockReturnValue({
    home: {
      id: 'home-1',
      name: 'My Home',
      allowJoinCode: true,
      joinCode: 'ABC123',
      membersConnection: { edges: [], totalCount: 0 },
      invitesConnection: { edges: [], totalCount: 0 },
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
  useAppStore.mockImplementation(
    <T,>(selector: (state: RootState) => T): T =>
      selector({ user: { id: 'user-1' } } as Partial<RootState> as RootState),
  );
});

describe('HomeDetailScreen', () => {
  const defaultProps = {
    route: { params: { homeId: 'home-1' } },
  };

  /**
   * The gate is `!home`, not `loading || !home`. Under `cache-and-network`
   * Apollo reports `loading: true` for the whole network leg on EVERY mount —
   * `nextFetchPolicy` lives on the ObservableQuery and useQuery builds a new
   * one each time — so `loading ||` threw the cached home away and showed a
   * spinner on every visit, for as long as the request took.
   */
  it('renders the cached home while a background refresh is in flight', () => {
    const {
      useHomeDetailManagement,
    } = require('#features/home/screens/useHomeDetailManagement');
    useHomeDetailManagement.mockReturnValue({
      ...useHomeDetailManagement(),
      loading: true,
    });

    const { getByText, queryByText } = render(
      <HomeDetailScreen {...defaultProps} />,
    );
    expect(getByText('Home Name: My Home')).toBeTruthy();
    expect(queryByText('Loading...')).toBeNull();
  });

  it('renders home detail template', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Home Details')).toBeTruthy();
  });

  it('shows home name in editable field', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Home Name: My Home')).toBeTruthy();
  });

  // The API's rule (UpdateHomeInput.name), so a refused name is never sent.
  it('checks a new home name as the API does before saving it', () => {
    render(<HomeDetailScreen {...defaultProps} />);
    const validate = mockEditableFieldProps
      .filter(props => props.label === 'Home Name')
      .at(-1)?.validation;

    expect(validate?.(' \t ')).toBe('Please enter a home name');
    expect(validate?.('a'.repeat(101))).toBe('Keep the name to 100 characters');
    expect(validate?.('a'.repeat(100))).toBeNull();
    expect(validate?.('Shtëpia')).toBeNull();
  });

  it('shows join code when enabled', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('ABC123')).toBeTruthy();
  });

  it('shows members section', () => {
    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Members Section')).toBeTruthy();
  });

  describe('dietary needs', () => {
    const withMembers = (totalCount: number) => {
      const {
        useHomeDetailManagement,
      } = require('#features/home/screens/useHomeDetailManagement');
      // The default return beforeEach set, read without calling a hook.
      const base = useHomeDetailManagement.getMockImplementation()();
      useHomeDetailManagement.mockReturnValue({
        ...base,
        home: { ...base.home, membersConnection: { edges: [], totalCount } },
      });
    };

    it('opens the household’s dietary needs once the home has another member', () => {
      withMembers(2);
      const { getByText } = render(<HomeDetailScreen {...defaultProps} />);

      fireEvent.press(getByText("What members can't eat"));

      expect(useAppNavigation().toHomeDietaryNeeds).toHaveBeenCalledWith({
        homeId: 'home-1',
      });
    });

    it('offers no dietary needs to a home of one', () => {
      withMembers(1);
      const { queryByText } = render(<HomeDetailScreen {...defaultProps} />);

      expect(queryByText("What members can't eat")).toBeNull();
    });
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
    } = require('#features/home/screens/useHomeDetailManagement');
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
    } = require('#features/home/screens/useHomeDetailManagement');
    useHomeDetailManagement.mockReturnValue({
      home: {
        id: 'home-1',
        name: 'My Home',
        allowJoinCode: true,
        joinCode: 'ABC123',
        membersConnection: { edges: [], totalCount: 0 },
        invitesConnection: { edges: [], totalCount: 0 },
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
    useAppStore.mockImplementation(
      <T,>(selector: (state: RootState) => T): T =>
        selector({ user: { id: 'user-2' } } as Partial<RootState> as RootState),
    );

    const { getByText } = render(<HomeDetailScreen {...defaultProps} />);
    expect(getByText('Leave Home')).toBeTruthy();
  });
});
