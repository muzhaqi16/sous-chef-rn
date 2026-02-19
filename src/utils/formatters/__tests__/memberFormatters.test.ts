import { getMemberDisplayName, Member } from '../memberFormatters';

function makeMember(overrides: Partial<Member> = {}): Member {
  return {
    id: 'm1',
    role: 'MEMBER',
    status: 'ACTIVE',
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
        profile: { firstName: 'John', lastName: 'Doe', displayName: 'Profile Name' },
      },
    });
    expect(getMemberDisplayName(member, 'different-user')).toBe('Custom Name');
  });

  it('falls back to profile displayName', () => {
    const member = makeMember({
      user: {
        id: 'u2',
        email: 'test@example.com',
        profile: { firstName: 'John', lastName: 'Doe', displayName: 'Profile Name' },
      },
    });
    expect(getMemberDisplayName(member)).toBe('Profile Name');
  });

  it('falls back to profile firstName', () => {
    const member = makeMember({
      user: {
        id: 'u2',
        email: 'test@example.com',
        profile: { firstName: 'John', lastName: 'Doe', displayName: null },
      },
    });
    expect(getMemberDisplayName(member)).toBe('John');
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
