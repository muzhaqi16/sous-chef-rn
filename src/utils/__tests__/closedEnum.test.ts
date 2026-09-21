import type { MembershipRole } from '#/graphql/generated/schemaTypes';
import { knownEntry } from '../closedEnum';
import { formatRole } from '../formatters/roleFormatters';
import { t } from '#/i18n';

/** Server and app ship separately, so a closed enum can grow under a build. */
describe('a member this build has never heard of', () => {
  it('reads as absent from a map, not as a crash', () => {
    const table: Record<'A' | 'B', string> = { A: 'a', B: 'b' };
    expect(knownEntry(table, 'A')).toBe('a');
    expect(knownEntry(table, 'C' as 'A')).toBeUndefined();
  });

  it('renders a role as a member rather than as nothing', () => {
    expect(formatRole('SUPERVISOR' as MembershipRole)).toBe(t('roles.member'));
  });
});
