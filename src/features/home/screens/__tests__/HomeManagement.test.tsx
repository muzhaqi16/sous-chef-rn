'use no memo';

import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { kitTestIDs } from '#components/testIDs';
import { homeTestIDs } from '#features/home/testIDs';
import { HomeManagement } from '../HomeManagement';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler');
jest.mock('#/apollo/links/refreshToken');

jest.mock('#hooks/navigation/useAppNavigation');

jest.mock('#hooks/performance/useScreenTransition');

jest.mock('#features/home/hooks/useHomeManagement', () => ({
  useHomeManagement: jest.fn(() => ({
    homes: [
      {
        id: 'home-1',
        name: 'My Home',
        members: [{ user: { id: 'user-1' }, role: 'OWNER' }],
        myMembership: { canManageHome: true },
      },
    ],
    remoteDefaultHomeId: 'home-1',
    loading: false,
    hasResult: true,
    creating: false,
    joiningByCode: false,
    loadingPreview: false,
    previewHome: null,
    createHome: jest.fn(),
    deleteHome: jest.fn(),
    setDefaultHome: jest.fn(),
    inviteUserToHome: jest.fn(),
    joinHomeByCode: jest.fn(),
    previewHomeByCode: jest.fn(),
    stats: { totalHomes: 1, totalMembers: 1, totalPantries: 1 },
    refetch: jest.fn().mockResolvedValue({}),
  })),
}));

jest.mock('#features/home/hooks/useInviteUserModal', () => ({
  useInviteUserModal: jest.fn(() => ({
    show: jest.fn(),
    InviteModalComponent: null,
  })),
}));

jest.mock('#features/home/utils/homePermissions', () => ({
  getInvitableRoles: jest.fn(() => ['MEMBER']),
  canInviteToHome: jest.fn(() => true),
}));

jest.mock('#components/organisms/Header', () => ({
  Header: ({
    title,
    rightActions,
  }: {
    title?: string;
    rightActions?: { testID?: string; onPress: () => void }[];
  }) => {
    const { Pressable, Text, View } = require('react-native');
    return (
      <View>
        <Text>{title}</Text>
        {rightActions?.map(action => (
          <Pressable
            key={action.testID}
            testID={action.testID}
            onPress={action.onPress}
          />
        ))}
      </View>
    );
  },
}));

jest.mock('#components/molecules/BaseInput/BaseInput', () => ({
  BaseInput: () => null,
}));

jest.mock('#components/molecules/Button', () => ({
  Button: () => null,
}));

jest.mock('#features/home/components/HomeStats', () => ({
  HomeStats: () => null,
}));

jest.mock('#features/home/components/CreateHomeForm', () => ({
  CreateHomeForm: () => {
    const { View } = require('react-native');
    return <View testID="create-home-form" />;
  },
}));

// Captures every render's props so tests can assert the gating computed by the
// screen (the card itself is presentation-only here).
const mockHomeCardProps: Array<{
  homeRef?: { name?: string; id?: string };
  canDelete?: boolean;
  canInvite?: boolean;
  isDefault?: boolean;
  isHighlighted?: boolean;
  onSetDefault?: (homeId: string) => void | Promise<void>;
}> = [];
jest.mock('#features/home/components/HomeCard', () => ({
  HomeCard: (props: {
    homeRef?: { name?: string; id?: string };
    canDelete?: boolean;
    canInvite?: boolean;
    isDefault?: boolean;
    isHighlighted?: boolean;
    onSetDefault?: (homeId: string) => void | Promise<void>;
  }) => {
    mockHomeCardProps.push(props);
    return props.homeRef?.name;
  },
}));

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock('#/services/errorService');

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    container: {},
    cardWithShadow: {},
  },
}));

jest.mock('#/utils/finallyHelpers');

/** The `useHomeManagement` surface this screen reads, in one place. */
const baseHookReturn = {
  homes: [],
  remoteDefaultHomeId: null as string | null,
  loading: false,
  hasResult: true,
  creating: false,
  joiningByCode: false,
  loadingPreview: false,
  previewHome: null,
  createHome: jest.fn(),
  deleteHome: jest.fn(),
  setDefaultHome: jest.fn(),
  inviteUserToHome: jest.fn(),
  joinHomeByCode: jest.fn(),
  previewHomeByCode: jest.fn(),
  stats: { totalHomes: 0, totalMembers: 0, totalPantries: 0 },
  refetch: jest.fn().mockResolvedValue({}),
};

const mockHook = (overrides: Record<string, unknown>) => {
  const { useHomeManagement } = jest.requireMock(
    '#features/home/hooks/useHomeManagement',
  );
  useHomeManagement.mockReturnValue({ ...baseHookReturn, ...overrides });
};

describe('HomeManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockHomeCardProps.length = 0;
  });

  it('renders the home management screen', () => {
    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('shows loading state when initial loading', () => {
    const { useHomeManagement } = jest.requireMock(
      '#features/home/hooks/useHomeManagement',
    );
    useHomeManagement.mockReturnValue({
      homes: [],
      defaultHomeId: null,
      loading: true,
      hasResult: false,
      creating: false,
      joiningByCode: false,
      loadingPreview: false,
      previewHome: null,
      createHome: jest.fn(),
      deleteHome: jest.fn(),
      setDefaultHome: jest.fn(),
      inviteUserToHome: jest.fn(),
      joinHomeByCode: jest.fn(),
      previewHomeByCode: jest.fn(),
      stats: { totalHomes: 0, totalMembers: 0, totalPantries: 0 },
      refetch: jest.fn(),
    });

    const { getByTestId } = render(<HomeManagement />);
    expect(getByTestId(kitTestIDs.stateLoading)).toBeTruthy();
  });

  it('shows the error state when the first read settles with no answer', () => {
    mockHook({ loading: false, hasResult: false });

    const { getByTestId, queryByText } = render(<HomeManagement />);

    expect(getByTestId(kitTestIDs.stateError)).toBeTruthy();
    expect(queryByText('My Home')).toBeNull();
  });

  // Creating and joining are local-first, so an unanswered first read must
  // not hide the form they live in.
  it('opens the create form offline with nothing cached', () => {
    mockHook({ loading: false, hasResult: false });

    const { getByTestId } = render(<HomeManagement />);
    fireEvent.press(getByTestId(homeTestIDs.managementAddButton));

    expect(getByTestId('create-home-form')).toBeTruthy();
  });

  it('keeps preserved homes on screen when a refetch fails', () => {
    mockHook({
      homes: [{ id: 'home-1', name: 'My Home', myMembership: {} }],
      loading: false,
      hasResult: true,
    });

    const { queryByTestId } = render(<HomeManagement />);

    expect(queryByTestId(kitTestIDs.stateError)).toBeNull();
    expect(mockHomeCardProps.at(-1)?.homeRef?.id).toBe('home-1');
  });

  it('renders homes list when homes exist', () => {
    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with empty homes list', () => {
    const { useHomeManagement } = jest.requireMock(
      '#features/home/hooks/useHomeManagement',
    );
    useHomeManagement.mockReturnValue({
      homes: [],
      defaultHomeId: null,
      loading: false,
      hasResult: true,
      creating: false,
      joiningByCode: false,
      loadingPreview: false,
      previewHome: null,
      createHome: jest.fn(),
      deleteHome: jest.fn(),
      setDefaultHome: jest.fn(),
      inviteUserToHome: jest.fn(),
      joinHomeByCode: jest.fn(),
      previewHomeByCode: jest.fn(),
      stats: { totalHomes: 0, totalMembers: 0, totalPantries: 0 },
      refetch: jest.fn(),
    });

    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders multiple homes sorted with default first', () => {
    const { useHomeManagement } = jest.requireMock(
      '#features/home/hooks/useHomeManagement',
    );
    useHomeManagement.mockReturnValue({
      homes: [
        {
          id: 'home-2',
          name: 'Vacation',
          members: [{ user: { id: 'user-1' }, role: 'MEMBER' }],
          myMembership: { canManageHome: false },
        },
        {
          id: 'home-1',
          name: 'My Home',
          members: [{ user: { id: 'user-1' }, role: 'OWNER' }],
          myMembership: { canManageHome: true },
        },
      ],
      remoteDefaultHomeId: 'home-1',
      loading: false,
      hasResult: true,
      creating: false,
      joiningByCode: false,
      loadingPreview: false,
      previewHome: null,
      createHome: jest.fn(),
      deleteHome: jest.fn(),
      setDefaultHome: jest.fn(),
      inviteUserToHome: jest.fn(),
      joinHomeByCode: jest.fn(),
      previewHomeByCode: jest.fn(),
      stats: { totalHomes: 2, totalMembers: 2, totalPantries: 2 },
      refetch: jest.fn(),
    });

    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders while creating a home', () => {
    const { useHomeManagement } = jest.requireMock(
      '#features/home/hooks/useHomeManagement',
    );
    useHomeManagement.mockReturnValue({
      homes: [
        {
          id: 'home-1',
          name: 'My Home',
          members: [{ user: { id: 'user-1' }, role: 'OWNER' }],
          myMembership: { canManageHome: true },
        },
      ],
      remoteDefaultHomeId: 'home-1',
      loading: false,
      hasResult: true,
      creating: true,
      joiningByCode: false,
      loadingPreview: false,
      previewHome: null,
      createHome: jest.fn(),
      deleteHome: jest.fn(),
      setDefaultHome: jest.fn(),
      inviteUserToHome: jest.fn(),
      joinHomeByCode: jest.fn(),
      previewHomeByCode: jest.fn(),
      stats: { totalHomes: 1, totalMembers: 1, totalPantries: 1 },
      refetch: jest.fn(),
    });

    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders while joining by code', () => {
    const { useHomeManagement } = jest.requireMock(
      '#features/home/hooks/useHomeManagement',
    );
    useHomeManagement.mockReturnValue({
      homes: [],
      defaultHomeId: null,
      loading: false,
      hasResult: true,
      creating: false,
      joiningByCode: true,
      loadingPreview: false,
      previewHome: null,
      createHome: jest.fn(),
      deleteHome: jest.fn(),
      setDefaultHome: jest.fn(),
      inviteUserToHome: jest.fn(),
      joinHomeByCode: jest.fn(),
      previewHomeByCode: jest.fn(),
      stats: { totalHomes: 0, totalMembers: 0, totalPantries: 0 },
      refetch: jest.fn(),
    });

    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with preview home visible', () => {
    const { useHomeManagement } = jest.requireMock(
      '#features/home/hooks/useHomeManagement',
    );
    useHomeManagement.mockReturnValue({
      homes: [],
      defaultHomeId: null,
      loading: false,
      hasResult: true,
      creating: false,
      joiningByCode: false,
      loadingPreview: false,
      previewHome: { id: 'preview-1', name: 'Preview Home', memberCount: 3 },
      createHome: jest.fn(),
      deleteHome: jest.fn(),
      setDefaultHome: jest.fn(),
      inviteUserToHome: jest.fn(),
      joinHomeByCode: jest.fn(),
      previewHomeByCode: jest.fn(),
      stats: { totalHomes: 0, totalMembers: 0, totalPantries: 0 },
      refetch: jest.fn(),
    });

    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with loading preview', () => {
    const { useHomeManagement } = jest.requireMock(
      '#features/home/hooks/useHomeManagement',
    );
    useHomeManagement.mockReturnValue({
      homes: [],
      defaultHomeId: null,
      loading: false,
      hasResult: true,
      creating: false,
      joiningByCode: false,
      loadingPreview: true,
      previewHome: null,
      createHome: jest.fn(),
      deleteHome: jest.fn(),
      setDefaultHome: jest.fn(),
      inviteUserToHome: jest.fn(),
      joinHomeByCode: jest.fn(),
      previewHomeByCode: jest.fn(),
      stats: { totalHomes: 0, totalMembers: 0, totalPantries: 0 },
      refetch: jest.fn(),
    });

    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('renders with home where user cannot manage', () => {
    const { useHomeManagement } = jest.requireMock(
      '#features/home/hooks/useHomeManagement',
    );
    useHomeManagement.mockReturnValue({
      homes: [
        {
          id: 'home-1',
          name: 'Shared Home',
          members: [
            { user: { id: 'user-1' }, role: 'GUEST' },
            { user: { id: 'user-2' }, role: 'OWNER' },
          ],
          myMembership: { canManageHome: false },
        },
      ],
      defaultHomeId: null,
      loading: false,
      hasResult: true,
      creating: false,
      joiningByCode: false,
      loadingPreview: false,
      previewHome: null,
      createHome: jest.fn(),
      deleteHome: jest.fn(),
      setDefaultHome: jest.fn(),
      inviteUserToHome: jest.fn(),
      joinHomeByCode: jest.fn(),
      previewHomeByCode: jest.fn(),
      stats: { totalHomes: 1, totalMembers: 2, totalPantries: 0 },
      refetch: jest.fn(),
    });

    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  // deleteHome is @requireAccess(Home, OWNER) server-side. ADMINs hold
  // canManageHome by default, so gating Delete on that flag showed them an
  // affordance that could only return FORBIDDEN.
  describe('Delete gating follows the OWNER role', () => {
    const baseReturn = {
      ...baseHookReturn,
      stats: { totalHomes: 1, totalMembers: 1, totalPantries: 0 },
    };

    const homeWithMembership = (membership: {
      role: string;
      canManageHome: boolean;
    }) => ({
      id: 'home-1',
      name: 'Gated Home',
      members: [{ user: { id: 'user-1' }, role: membership.role }],
      myMembership: membership,
    });

    it('ADMIN with canManageHome does NOT see Delete', () => {
      const { useHomeManagement } = jest.requireMock(
        '#features/home/hooks/useHomeManagement',
      );
      useHomeManagement.mockReturnValue({
        ...baseReturn,
        homes: [homeWithMembership({ role: 'ADMIN', canManageHome: true })],
      });

      render(<HomeManagement />);
      expect(mockHomeCardProps.at(-1)?.canDelete).toBe(false);
    });

    it('OWNER sees Delete', () => {
      const { useHomeManagement } = jest.requireMock(
        '#features/home/hooks/useHomeManagement',
      );
      useHomeManagement.mockReturnValue({
        ...baseReturn,
        homes: [homeWithMembership({ role: 'OWNER', canManageHome: true })],
      });

      render(<HomeManagement />);
      expect(mockHomeCardProps.at(-1)?.canDelete).toBe(true);
    });
  });

  describe('the Default chip', () => {
    // The chip claims the ACCOUNT's default home, which the device-local
    // selection is allowed to differ from.
    const twoHomes = [
      { id: 'home-1', name: 'First', myMembership: { canManageHome: true } },
      { id: 'home-2', name: 'Second', myMembership: { canManageHome: true } },
    ];

    it('follows the server default', () => {
      mockHook({
        homes: twoHomes,
        remoteDefaultHomeId: 'home-2',
      });

      render(<HomeManagement />);

      const byId = new Map(
        mockHomeCardProps.map(p => [p.homeRef?.id, p.isDefault]),
      );
      expect(byId.get('home-2')).toBe(true);
      expect(byId.get('home-1')).toBe(false);
    });

    it('sorts the server default first', () => {
      mockHook({
        homes: twoHomes,
        remoteDefaultHomeId: 'home-2',
      });

      render(<HomeManagement />);

      expect(mockHomeCardProps[0]?.homeRef?.id).toBe('home-2');
    });
  });

  describe('setting the default home', () => {
    const twoHomes = [
      { id: 'home-1', name: 'First', myMembership: { canManageHome: true } },
      { id: 'home-2', name: 'Second', myMembership: { canManageHome: true } },
    ];

    it('does not highlight a home whose switch was refused', async () => {
      // A refusal rolls the chip back, so highlighting anyway leaves the two
      // pointing at different homes.
      const setDefaultHome = jest.fn().mockResolvedValue(false);
      mockHook({
        homes: twoHomes,
        remoteDefaultHomeId: 'home-1',
        setDefaultHome,
      });

      render(<HomeManagement />);

      const onSetDefault = mockHomeCardProps.find(
        p => p.homeRef?.id === 'home-2',
      )?.onSetDefault;

      await act(async () => {
        await onSetDefault?.('home-2');
      });

      expect(setDefaultHome).toHaveBeenCalledWith('home-2');
      expect(mockHomeCardProps.some(p => p.isHighlighted)).toBe(false);
    });

    it('highlights a home whose switch stood', async () => {
      const setDefaultHome = jest.fn().mockResolvedValue(true);
      mockHook({
        homes: twoHomes,
        remoteDefaultHomeId: 'home-1',
        setDefaultHome,
      });

      render(<HomeManagement />);

      const onSetDefault = mockHomeCardProps.find(
        p => p.homeRef?.id === 'home-2',
      )?.onSetDefault;

      await act(async () => {
        await onSetDefault?.('home-2');
      });

      expect(
        mockHomeCardProps.some(
          p => p.homeRef?.id === 'home-2' && p.isHighlighted,
        ),
      ).toBe(true);
    });
  });
});
