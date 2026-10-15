import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useEffect, useRef, useState } from 'react';
import { useSession } from '../../features/auth/SessionProvider';
import { useOwnProfile } from '../../features/me/queries';
import type { MemberParams } from '../../navigation/types';
import { BasicsStep } from '../profileSetup/BasicsStep';
import { InterestsStep } from '../profileSetup/InterestsStep';
import { ModesStep } from '../profileSetup/ModesStep';
import { PhotosStep } from '../profileSetup/PhotosStep';
import { PromptsStep } from '../profileSetup/PromptsStep';
import type { Notice } from '../profileSetup/SetupStepScreen';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';

type Props = NativeStackScreenProps<MemberParams, 'EditProfile'>;

// One profile setup step on its own. Leaving saves it, as setup does (Back, Android back or a
// swipe); a refused save keeps the Member here with the reason.
export function EditProfileScreen({ route, navigation }: Props) {
  const userId = useSession().session!.user.id;
  const profile = useOwnProfile(userId);
  const beforeLeave = useRef<() => Promise<void>>(undefined);
  const [notice, setNotice] = useState<Notice>();
  const saving = useRef(false);

  useEffect(
    () =>
      navigation.addListener('beforeRemove', event => {
        const save = beforeLeave.current;
        if (!save) {
          return;
        }
        event.preventDefault();
        if (saving.current) {
          return;
        }
        saving.current = true;
        save()
          .then(
            () => {
              beforeLeave.current = undefined;
              navigation.dispatch(event.data.action);
            },
            (error: Error) => setNotice({ message: error.message }),
          )
          .finally(() => {
            saving.current = false;
          });
      }),
    [navigation],
  );

  if (profile.isError) {
    return <LoadErrorScreen onRetry={profile.retry} />;
  }
  if (!profile.draft || !profile.photos) {
    return <LoadingScreen />;
  }

  const props = {
    userId,
    draft: profile.draft,
    beforeLeave,
    notice,
    editing: true,
    onBack: () => navigation.goBack(),
    onDone: () => {
      beforeLeave.current = undefined;
      navigation.goBack();
    },
  };
  switch (route.params.section) {
    case 'basics':
      return <BasicsStep {...props} />;
    case 'photos':
      return <PhotosStep {...props} />;
    case 'prompts':
      return <PromptsStep {...props} />;
    case 'modes':
      return <ModesStep {...props} />;
    case 'interests':
      return <InterestsStep {...props} />;
  }
}
