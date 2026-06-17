import React from 'react';
import { EmptyState } from '#components/base/EmptyState';

export const EmptyNotifications: React.FC = () => {
  return (
    <EmptyState
      icon="notifications-outline"
      title="No notifications yet"
      description="We'll notify you when something important happens"
    />
  );
};
