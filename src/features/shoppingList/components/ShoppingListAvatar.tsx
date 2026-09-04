import React from 'react';
import { Avatar } from '#features/shoppingList/components/Avatar';
import {
  getShoppingListDisplayAvatarInfo,
  type ShoppingListWithHome,
} from '#features/shoppingList/utils/ownershipHelpers';

interface ShoppingListAvatarProps {
  /** Shares the resolver's own input type so the two can't drift apart. */
  list: ShoppingListWithHome;
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
