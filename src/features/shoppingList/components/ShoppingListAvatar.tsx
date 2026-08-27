/**
 * ShoppingListAvatar Component
 *
 * Displays avatar for shopping lists with priority:
 * 1. Home owner's avatar (if list belongs to a home)
 * 2. List creator's avatar (for personal lists)
 */

import React from 'react';
import { Avatar } from '#components/atoms/Avatar';
import {
  getShoppingListDisplayAvatarInfo,
  type ShoppingListWithHome,
} from '#utils/ownershipHelpers';

interface ShoppingListAvatarProps {
  /**
   * Shopping list with ownerships and optional home data. Shares the resolver's
   * own input type so the accepted shape can't drift from what it reads.
   */
  list: ShoppingListWithHome;
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
