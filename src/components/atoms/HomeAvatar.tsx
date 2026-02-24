/**
 * HomeAvatar Component
 *
 * Displays owner avatar for homes with fallback to initials or icon
 */

import React from 'react';
import {Avatar} from './Avatar';
import {getHomeOwnerInfo} from '#utils/ownershipHelpers';

interface HomeAvatarProps {
  /** Home with members data */
  home: {
    members?: Array<{
      id?: string;
      userId?: string;
      role: string;
      status: string;
      displayName?: string;
      user?: {
        id: string;
        email?: string;
        profile?: {
          firstName?: string | null;
          lastName?: string | null;
          displayName?: string | null;
          avatar?: string | null;
        } | null;
      } | null;
    }> | null;
  };
  /** Size of avatar in pixels */
  size?: number;
}

export const HomeAvatar: React.FC<HomeAvatarProps> = ({home, size = 40}) => {
  const ownerInfo = getHomeOwnerInfo(home as any);

  return (
    <Avatar
      uri={ownerInfo?.avatar}
      name={ownerInfo?.displayName || ownerInfo?.email}
      size={size}
      fallbackIcon="home-outline"
    />
  );
};
