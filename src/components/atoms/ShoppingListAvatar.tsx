/**
 * ShoppingListAvatar Component
 *
 * Displays avatar for shopping lists with priority:
 * 1. Home owner's avatar (if list belongs to a home)
 * 2. List creator's avatar (for personal lists)
 */

import React from 'react';
import {Avatar} from './Avatar';
import {getShoppingListDisplayAvatarInfo} from '#utils/ownershipHelpers';

interface ShoppingListAvatarProps {
  /** Shopping list with ownerships and optional home data */
  list: {
    ownerships?: Array<{
      userId: string;
      user?: {
        id: string;
        email: string;
        profile?: {
          displayName?: string | null;
          avatar?: string | null;
        } | null;
      } | null;
    }> | null;
    home?: {
      membersConnection?: {
        edges?: Array<{
          node?: {
            role: string;
            user?: {
              id: string;
              email?: string;
              profile?: {
                displayName?: string | null;
                avatar?: string | null;
              } | null;
            } | null;
          } | null;
        } | null> | null;
      } | null;
    } | null;
  };
  /** Size of avatar in pixels */
  size?: number;
}

export const ShoppingListAvatar: React.FC<ShoppingListAvatarProps> = ({
  list,
  size = 40,
}) => {
  const avatarInfo = getShoppingListDisplayAvatarInfo(list);

  return (
    <Avatar
      uri={avatarInfo?.avatar}
      name={avatarInfo?.displayName || avatarInfo?.email}
      size={size}
      fallbackIcon="cart-outline"
    />
  );
};
