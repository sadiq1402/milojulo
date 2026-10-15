import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import React, { useRef } from 'react';
import { useSession } from '../../features/auth/SessionProvider';
import { useMyPhotos } from '../../features/photos/queries';
import { useProfileDraft } from '../../features/profileSetup/queries';
import type { MemberParams } from '../../navigation/types';
import { BasicsStep } from '../profileSetup/BasicsStep';
import { InterestsStep } from '../profileSetup/InterestsStep';
import { ModesStep } from '../profileSetup/ModesStep';
import { PhotosStep } from '../profileSetup/PhotosStep';
import { PromptsStep } from '../profileSetup/PromptsStep';
import { EditingContext } from '../profileSetup/SetupStepScreen';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';

type Props = NativeStackScreenProps<MemberParams, 'EditProfile'>;

// One profile setup step on its own: Save writes it (the database keeps the profile minimum
// and says what's missing), Back leaves without saving. Photos save as they change.
export function EditProfileScreen({ route, navigation }: Props) {
  const userId = useSession().session!.user.id;
  const draft = useProfileDraft(userId);
  const photos = useMyPhotos();
  const beforeLeave = useRef<() => Promise<void>>(undefined);

  if (draft.isError || photos.isError) {
    return (
      <LoadErrorScreen
        onRetry={() => {
          draft.refetch();
          photos.refetch();
        }}
      />
    );
  }
  if (!draft.data || !photos.data) {
    return <LoadingScreen />;
  }

  const props = {
    userId,
    draft: draft.data,
    beforeLeave,
    onBack: () => navigation.goBack(),
    onDone: () => navigation.goBack(),
  };
  const step = (() => {
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
        return <InterestsStep {...props} onRefused={() => {}} />;
    }
  })();
  return <EditingContext.Provider value>{step}</EditingContext.Provider>;
}
