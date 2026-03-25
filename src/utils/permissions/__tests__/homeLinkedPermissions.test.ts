import { MembershipRole } from '#generated';
import {
  mapRoleToPermissionLevel,
  getPermissionLevel,
  canEdit,
  canDelete,
  canView,
  type PermissionLevel,
} from '../homeLinkedPermissions';

describe('homeLinkedPermissions', () => {
  describe('mapRoleToPermissionLevel', () => {
    it.each<[MembershipRole, PermissionLevel]>([
      [MembershipRole.Owner, 'owner'],
      [MembershipRole.Admin, 'admin'],
      [MembershipRole.Member, 'editor'],
      [MembershipRole.Guest, 'viewer'],
    ])('maps %s → %s', (role, expected) => {
      expect(mapRoleToPermissionLevel(role)).toBe(expected);
    });
  });

  describe('getPermissionLevel', () => {
    it('returns owner for personal resources (no homeId)', () => {
      expect(getPermissionLevel({}, false)).toBe('owner');
      expect(getPermissionLevel({ homeId: null }, false)).toBe('owner');
    });

    it('returns owner when user is the creator of a home resource', () => {
      const resource = { homeId: 'h1' };
      expect(getPermissionLevel(resource, true)).toBe('owner');
    });

    it('maps membership role for non-creator home members', () => {
      const resource = (role: MembershipRole) => ({
        homeId: 'h1',
        home: { myMembership: { role } },
      });

      expect(getPermissionLevel(resource(MembershipRole.Owner), false)).toBe(
        'owner',
      );
      expect(getPermissionLevel(resource(MembershipRole.Admin), false)).toBe(
        'admin',
      );
      expect(getPermissionLevel(resource(MembershipRole.Member), false)).toBe(
        'editor',
      );
      expect(getPermissionLevel(resource(MembershipRole.Guest), false)).toBe(
        'viewer',
      );
    });

    it('returns none when no membership exists', () => {
      expect(getPermissionLevel({ homeId: 'h1' }, false)).toBe('none');
      expect(getPermissionLevel({ homeId: 'h1', home: null }, false)).toBe(
        'none',
      );
      expect(
        getPermissionLevel(
          { homeId: 'h1', home: { myMembership: null } },
          false,
        ),
      ).toBe('none');
    });
  });

  describe('canEdit', () => {
    it.each<[PermissionLevel, boolean]>([
      ['owner', true],
      ['admin', true],
      ['editor', true],
      ['viewer', false],
      ['none', false],
    ])('%s → %s', (level, expected) => {
      expect(canEdit(level)).toBe(expected);
    });
  });

  describe('canDelete', () => {
    it.each<[PermissionLevel, boolean]>([
      ['owner', true],
      ['admin', true],
      ['editor', false],
      ['viewer', false],
      ['none', false],
    ])('%s → %s', (level, expected) => {
      expect(canDelete(level)).toBe(expected);
    });
  });

  describe('canView', () => {
    it.each<[PermissionLevel, boolean]>([
      ['owner', true],
      ['admin', true],
      ['editor', true],
      ['viewer', true],
      ['none', false],
    ])('%s → %s', (level, expected) => {
      expect(canView(level)).toBe(expected);
    });
  });
});
