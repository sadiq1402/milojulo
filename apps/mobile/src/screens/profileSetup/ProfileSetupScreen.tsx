import React, { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useRefreshAccountStage } from '../../features/account/useAccountStage';
import { useSession } from '../../features/auth/SessionProvider';
import { useMyPhotos } from '../../features/photos/queries';
import {
  firstIncompleteStep,
  setupSteps,
  type SetupStep,
} from '../../features/profileSetup/model';
import { useProfileDraft } from '../../features/profileSetup/queries';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';
import { BasicsStep } from './BasicsStep';
import { InterestsStep } from './InterestsStep';
import { ModesStep } from './ModesStep';
import { PhotosStep } from './PhotosStep';
import { PromptsStep } from './PromptsStep';

// Five steps, each saved as it's left; a returning Member resumes at the first one unfinished.
// Submitting refreshes the account stage, which swaps in the tabs on Discover.
export function ProfileSetupScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const draft = useProfileDraft(userId);
  const photos = useMyPhotos();
  const refreshStage = useRefreshAccountStage();
  const [chosen, setChosen] = useState<SetupStep>();
  const [notice, setNotice] = useState<string>();

  // Fixed at the first load, so finishing a step's minimum doesn't jump ahead by itself.
  const resumeAt = useRef<SetupStep>(undefined);
  const loaded = draft.data && photos.data;
  if (loaded && !resumeAt.current) {
    resumeAt.current = firstIncompleteStep(draft.data!, photos.data!.length);
  }
  const step = chosen ?? resumeAt.current ?? 'basics';
  const index = setupSteps.indexOf(step);
  const go = (next: SetupStep, message?: string) => {
    setNotice(message);
    setChosen(next);
  };
  const back = index > 0 ? () => go(setupSteps[index - 1]) : undefined;

  // Android's back button steps back through setup before leaving the app.
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (index <= 0) {
          return false;
        }
        setNotice(undefined);
        setChosen(setupSteps[index - 1]);
        return true;
      },
    );
    return () => subscription.remove();
  }, [index]);

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
  if (!loaded) {
    return <LoadingScreen />;
  }

  const props = {
    userId,
    draft: draft.data!,
    onBack: back,
    notice,
    onDone: () => go(setupSteps[index + 1]),
  };
  switch (step) {
    case 'basics':
      return <BasicsStep {...props} />;
    case 'photos':
      return <PhotosStep {...props} />;
    case 'prompts':
      return <PromptsStep {...props} />;
    case 'modes':
      return <ModesStep {...props} />;
    case 'interests':
      return (
        <InterestsStep
          {...props}
          onDone={() => refreshStage()}
          onRefused={(refusedAt, message) => go(refusedAt, message)}
        />
      );
  }
}
