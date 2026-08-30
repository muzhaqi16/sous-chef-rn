'use no memo';

import React from 'react';
import { act, render } from '@testing-library/react-native';
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
    initialLoading: false,
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

jest.mock('#/hooks/useInviteUserModal', () => ({
  useInviteUserModal: jest.fn(() => ({
    show: jest.fn(),
    InviteModalComponent: null,
  })),
}));

jest.mock('#/utils/permissions/homePermissions', () => ({
  findUserMembership: jest.fn(
    (members: Array<{ user?: { id?: string } }> | undefined, userId: string) =>
      members?.find(m => m.user?.id === userId),
  ),
  getInvitableRoles: jest.fn(() => ['MEMBER']),
  canInviteToHome: jest.fn(() => true),
}));

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: { title?: string }) => title,
}));

jest.mock('#/components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: () => null,
}));

jest.mock('#components/atoms/Button', () => ({
  Button: () => null,
}));

jest.mock('#features/home/components/HomeStats', () => ({
  HomeStats: () => null,
}));

jest.mock('#features/home/components/CreateHomeForm', () => ({
  CreateHomeForm: () => null,
}));

// Captures every render's props so tests can assert the gating computed by the
// screen (the card itself is presentation-only here).
const mockHomeCardProps: Array<{
  homeRef?: { name?: string; id?: string };
  canDelete?: boolean;
  canInvite?: boolean;
  isDefault?: boolean;
  isHighlighted?: boolean;
  onSetDefault?: (homeId: string) => void;
}> = [];
jest.mock('#features/home/components/HomeCard', () => ({
  HomeCard: (props: {
    homeRef?: { name?: string; id?: string };
    canDelete?: boolean;
    canInvite?: boolean;
    isDefault?: boolean;
    isHighlighted?: boolean;
    onSetDefault?: (homeId: string) => void;
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
    loadingContainer: {},
    cardWithShadow: {},
  },
}));

jest.mock('#/utils/finallyHelpers');

jest.mock('#components/atoms/SousChefLoader', () => ({
  SousChefLoader: () => 'SousChefLoader',
}));

/**
 * The `useHomeManagement` surface this screen reads, in one place.
 *
 * `selectedHomeId` and `remoteDefaultHomeId` are deliberately DIFFERENT here:
 * they answer different questions (which home am I viewing vs. which is the
 * account's default) and the screen must never substitute one for the other.
 */
const baseHookReturn = {
  homes: [],
  selectedHome: null,
  selectedHomeId: null as string | null,
  remoteDefaultHomeId: null as string | null,
  initialLoading: false,
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
      initialLoading: true,
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
      initialLoading: false,
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
      initialLoading: false,
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
      initialLoading: false,
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
      initialLoading: false,
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
      initialLoading: false,
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
      initialLoading: false,
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
      initialLoading: false,
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
    // The chip claims the ACCOUNT's default home. `selectedHomeId` is a
    // separate, locally persisted "which home am I viewing" value that is
    // allowed to differ — reading it here made the chip point at one home
    // while the server said another, and the disagreement survived a restart.
    const twoHomes = [
      { id: 'home-1', name: 'First', myMembership: { canManageHome: true } },
      { id: 'home-2', name: 'Second', myMembership: { canManageHome: true } },
    ];

    it('follows the server default, not the local selection', () => {
      mockHook({
        homes: twoHomes,
        remoteDefaultHomeId: 'home-2',
        // Deliberately a DIFFERENT home: the user is viewing home-1.
        selectedHomeId: 'home-1',
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
        selectedHomeId: 'home-1',
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
        selectedHomeId: 'home-1',
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
        selectedHomeId: 'home-1',
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
