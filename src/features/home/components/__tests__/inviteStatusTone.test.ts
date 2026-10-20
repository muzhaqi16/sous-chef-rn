import { InviteStatus } from '#/graphql/generated/schemaTypes';
import { INVITE_STATUS_TONE } from '../inviteStatusTone';

describe('INVITE_STATUS_TONE', () => {
  it.each([
    [InviteStatus.Pending, 'warning'],
    [InviteStatus.Accepted, 'success'],
    [InviteStatus.Declined, 'danger'],
    [InviteStatus.Expired, 'tertiary'],
    [InviteStatus.Revoked, 'tertiary'],
    [InviteStatus.Used, 'tertiary'],
  ])('sets %s status text in the %s tone', (input, expected) => {
    expect(INVITE_STATUS_TONE[input]).toBe(expected);
  });
});
