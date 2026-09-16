import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { MembersList } from '../MembersList';
import { InviteStatus } from '#/graphql/generated/schemaTypes';
import { Text } from '#components/atoms/Text';

function textNode(label: string) {
  return screen
    .UNSAFE_getAllByType(Text)
    .find(node => node.props.children === label);
}

describe('MembersList', () => {
  it.each([
    [InviteStatus.Pending, 'Invited', 'warning'],
    [InviteStatus.Accepted, 'Accepted', 'success'],
    [InviteStatus.Declined, 'Declined', 'danger'],
    [InviteStatus.Revoked, 'Revoked', 'tertiary'],
  ])(
    'colours a %s invite chip text through tone, not a style',
    (status, label, tone) => {
      render(
        <MembersList
          members={[]}
          invites={[
            {
              __typename: 'HomeInvite',
              id: 'invite-1',
              email: 'alice@example.com',
              recipientName: 'Alice',
              status,
            },
          ]}
        />,
      );

      const name = textNode('Alice');
      expect(name?.props.tone).toBe(tone);
      expect(name?.props.style).toBeUndefined();

      const statusText = textNode(label);
      expect(statusText?.props.tone).toBe(tone);
      expect(statusText?.props.style).toBeUndefined();
    },
  );
});
