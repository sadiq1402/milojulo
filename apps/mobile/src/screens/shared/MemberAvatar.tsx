import React, { type ComponentProps } from 'react';
import { Avatar } from '../../components';
import { usePhotoUrl } from '../../features/photos/queries';

// An Avatar showing the Member's photo once its link arrives; the initial until then or without one.
export function MemberAvatar({
  photoId,
  ...props
}: Omit<ComponentProps<typeof Avatar>, 'uri'> & {
  photoId: string | null | undefined;
}) {
  const photo = usePhotoUrl(photoId);
  return <Avatar {...props} uri={photo.data} />;
}
