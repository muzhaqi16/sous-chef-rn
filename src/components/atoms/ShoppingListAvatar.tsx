/**
 * ShoppingListAvatar Component
 *
 * Displays owner avatar for shopping lists with fallback to initials or icon
 */

import React from 'react';
import {Avatar} from './Avatar';
import {getShoppingListOwnerInfo} from '#utils/ownershipHelpers';

interface ShoppingListAvatarProps {
  /** Shopping list with ownerships data */
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
  };
  /** Size of avatar in pixels */
  size?: number;
}

export const ShoppingListAvatar: React.FC<ShoppingListAvatarProps> = ({
  list,
  size = 40,
}) => {
  const ownerInfo = getShoppingListOwnerInfo(list);

  return (
    <Avatar
      uri={ownerInfo?.avatar}
      name={ownerInfo?.displayName || ownerInfo?.email}
      size={size}
      fallbackIcon="shopping-cart"
      fallbackIconLibrary="MaterialIcons"
    />
  );
};
