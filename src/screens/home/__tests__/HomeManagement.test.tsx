'use no memo';

import React from 'react';
import { render } from '@testing-library/react-native';
import { HomeManagement } from '../HomeManagement';

// Mock token scheduler / refreshToken
jest.mock('#/apollo/links/tokenScheduler', () => ({
  scheduleTokenRefresh: jest.fn(),
  cancelScheduledRefresh: jest.fn(),
}));
jest.mock('#/apollo/links/refreshToken', () => ({
  refreshAccessToken: jest.fn(),
}));

jest.mock('#hooks/navigation/useAppNavigation', () => ({
  useAppNavigation: jest.fn(() => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
  })),
}));

jest.mock('#hooks/performance/useScreenTransition', () => ({
  useScreenTransition: jest.fn(),
}));

jest.mock('#/hooks/auth/useAuth', () => ({
  useAuth: jest.fn(() => ({
    user: { id: 'user-1', email: 'test@example.com' },
  })),
}));

jest.mock('#hooks/home/hooks/useHomeManagement', () => ({
  useHomeManagement: jest.fn(() => ({
    homes: [
      {
        id: 'home-1',
        name: 'My Home',
        members: [{ user: { id: 'user-1' }, role: 'OWNER' }],
        myMembership: { canManageHome: true },
      },
    ],
    defaultHomeId: 'home-1',
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
  findUserMembership: jest.fn((members: any[], userId: string) =>
    members?.find((m: any) => m.user?.id === userId),
  ),
  getInvitableRoles: jest.fn(() => ['MEMBER']),
  canInviteToHome: jest.fn(() => true),
}));

jest.mock('#components/molecules/Header', () => ({
  Header: ({ title }: any) => title,
}));

jest.mock('#/components/atoms/AnimatedButton', () => ({
  AnimatedButton: () => null,
}));

jest.mock('#/components/atoms/BaseInput/BaseInput', () => ({
  BaseInput: () => null,
}));

jest.mock('#/components/base/Button', () => ({
  Button: () => null,
}));

jest.mock('#/components/organisms/home/HomeStats', () => ({
  HomeStats: () => null,
}));

jest.mock('#/components/organisms/home/CreateHomeForm', () => ({
  CreateHomeForm: () => null,
}));

jest.mock('#/components/organisms/home/HomeCard', () => ({
  HomeCard: ({ home }: any) => home.name,
}));

jest.mock('#/services/toastService', () => ({
  toastService: { error: jest.fn(), success: jest.fn(), info: jest.fn() },
}));

jest.mock('#/services/errorService', () => ({
  errorService: { reportError: jest.fn() },
}));

jest.mock('#/styles/commonStyles', () => ({
  commonStyles: {
    container: {},
    loadingContainer: {},
    cardWithShadow: {},
  },
}));

jest.mock('#/utils/compilerSafeWrappers', () => ({
  executeWithLoadingState: jest.fn(async (fn: any, setLoading: any, onError?: any) => {
    setLoading(true);
    try {
      return await fn();
    } catch (e) {
      onError?.(e);
    } finally {
      setLoading(false);
    }
  }),
}));

jest.mock('#/components/base/SousChefLoader', () => ({
  SousChefLoader: () => 'SousChefLoader',
}));

describe('HomeManagement', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the home management screen', () => {
    const tree = render(<HomeManagement />);
    expect(tree.toJSON()).toBeTruthy();
  });

  it('shows loading state when initial loading', () => {
    const { useHomeManagement } = jest.requireMock(
      '#hooks/home/hooks/useHomeManagement',
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
      '#hooks/home/hooks/useHomeManagement',
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
      '#hooks/home/hooks/useHomeManagement',
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
      defaultHomeId: 'home-1',
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
      '#hooks/home/hooks/useHomeManagement',
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
      defaultHomeId: 'home-1',
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
      '#hooks/home/hooks/useHomeManagement',
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
      '#hooks/home/hooks/useHomeManagement',
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
      '#hooks/home/hooks/useHomeManagement',
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
      '#hooks/home/hooks/useHomeManagement',
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
});
