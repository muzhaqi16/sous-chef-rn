import { MembershipRole, MembershipStatus } from '#/graphql/generated';
import {
  CollaboratorDisplayShape,
  getCollaboratorDisplayName,
  getMemberDisplayName,
  Member,
} from '../memberFormatters';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    role: MembershipRole.Member,
    status: MembershipStatus.Active,
    ...overrides,
  };
}

describe('getMemberDisplayName', () => {
  it('returns "You" for current user', () => {
    const member = makeMember({
      user: { id: 'u1', email: 'test@example.com' },
    });
    expect(getMemberDisplayName(member, 'u1')).toBe('You');
  });

  it('prefers member.displayName', () => {
    const member = makeMember({
      displayName: 'Custom Name',
      user: {
        id: 'u2',
        email: 'test@example.com',
        profile: { displayName: 'Profile Name' },
      },
    });
    expect(getMemberDisplayName(member, 'different-user')).toBe('Custom Name');
  });

  it('falls back to profile displayName', () => {
    const member = makeMember({
      user: {
        id: 'u2',
        email: 'test@example.com',
        profile: { displayName: 'Profile Name' },
      },
    });
    expect(getMemberDisplayName(member)).toBe('Profile Name');
  });

  it('falls back to email username part', () => {
    const member = makeMember({
      user: {
        id: 'u2',
        email: 'john.doe@example.com',
        profile: null,
      },
    });
    expect(getMemberDisplayName(member)).toBe('john.doe');
  });

  it('falls back to full email when no @ present', () => {
    const member = makeMember({
      user: {
        id: 'u2',
        email: 'noemail',
        profile: null,
      },
    });
    // 'noemail'.split('@')[0] = 'noemail' which is truthy, so it returns that
    expect(getMemberDisplayName(member)).toBe('noemail');
  });

  it('returns "Unknown Member" when no info available', () => {
    const member = makeMember({
      user: null,
    });
    expect(getMemberDisplayName(member)).toBe('Unknown Member');
  });

  it('does not return "You" when no currentUserId provided', () => {
    const member = makeMember({
      user: { id: 'u1', email: 'test@example.com' },
    });
    const result = getMemberDisplayName(member);
    expect(result).not.toBe('You');
  });

  it('does not return "You" when user IDs do not match', () => {
    const member = makeMember({
      user: { id: 'u1', email: 'test@example.com' },
    });
    expect(getMemberDisplayName(member, 'different-id')).not.toBe('You');
  });
});

type CollaboratorUser = NonNullable<CollaboratorDisplayShape['collaborator']>;
type CollaboratorProfile = NonNullable<CollaboratorUser['profile']>;

function makeProfile(
  overrides: Partial<CollaboratorProfile> = {},
): CollaboratorProfile {
  return {
    __typename: 'UserProfile',
    id: 'p1',
    displayName: null,
    avatar: null,
    ...overrides,
  };
}

function makeUser(overrides: Partial<CollaboratorUser> = {}): CollaboratorUser {
  return {
    __typename: 'User',
    id: 'u1',
    email: 'user@example.com',
    profile: null,
    ...overrides,
  };
}

function makeCollaborator(
  overrides: Partial<CollaboratorDisplayShape> = {},
): CollaboratorDisplayShape {
  return {
    email: null,
    collaboratorId: null,
    collaborator: null,
    ...overrides,
  };
}

describe('getCollaboratorDisplayName', () => {
  it('returns "You" when collaboratorId matches current user', () => {
    const collab = makeCollaborator({
      collaboratorId: 'u1',
      collaborator: makeUser({
        email: 'me@example.com',
        profile: makeProfile({ displayName: 'Me' }),
      }),
    });
    expect(getCollaboratorDisplayName(collab, 'u1')).toBe('You');
  });

  it('prefers collaborator.profile.displayName', () => {
    const collab = makeCollaborator({
      email: 'invite@example.com',
      collaboratorId: 'u2',
      collaborator: makeUser({
        id: 'u2',
        email: 'real@example.com',
        profile: makeProfile({ displayName: 'Artan M' }),
      }),
    });
    expect(getCollaboratorDisplayName(collab)).toBe('Artan M');
  });

  it('falls back to email username when collaborator user has no displayName', () => {
    const collab = makeCollaborator({
      email: 'invite@example.com',
      collaboratorId: 'u2',
      collaborator: makeUser({
        id: 'u2',
        email: 'john.doe@example.com',
        profile: makeProfile({ displayName: null }),
      }),
    });
    expect(getCollaboratorDisplayName(collab)).toBe('john.doe');
  });

  it('uses top-level email username for pending invites (no linked user)', () => {
    const collab = makeCollaborator({
      email: 'artan@muzhaqi.com',
      collaboratorId: null,
      collaborator: null,
    });
    expect(getCollaboratorDisplayName(collab)).toBe('artan');
  });

  it('returns "Unknown" when no email or collaborator info exists', () => {
    const collab = makeCollaborator();
    expect(getCollaboratorDisplayName(collab)).toBe('Unknown');
  });

  it('does not return "You" when no currentUserId provided', () => {
    const collab = makeCollaborator({
      collaboratorId: 'u1',
      collaborator: makeUser({ email: 'test@example.com' }),
    });
    expect(getCollaboratorDisplayName(collab)).not.toBe('You');
  });

  it('does not return "You" when collaboratorId does not match current user', () => {
    const collab = makeCollaborator({
      collaboratorId: 'u1',
      collaborator: makeUser({ email: 'test@example.com' }),
    });
    expect(getCollaboratorDisplayName(collab, 'different-id')).not.toBe('You');
  });
});
