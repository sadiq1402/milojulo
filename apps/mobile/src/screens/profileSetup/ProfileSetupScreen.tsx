import React, { useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { useRefreshAccountStage } from '../../features/account/useAccountStage';
import { useSession } from '../../features/auth/SessionProvider';
import { sendLocationAfterSetup } from '../../features/location/setup';
import { useMyPhotos } from '../../features/photos/queries';
import {
  firstIncompleteStep,
  setupSteps,
  type SetupStep,
} from '../../features/profileSetup/model';
import { submitProfile } from '../../features/profileSetup/api';
import { useProfileDraft } from '../../features/profileSetup/queries';
import { LoadErrorScreen, LoadingScreen } from '../StatusScreen';
import { BasicsStep } from './BasicsStep';
import { InterestsStep } from './InterestsStep';
import { ModesStep } from './ModesStep';
import { PhotosStep } from './PhotosStep';
import { PromptsStep } from './PromptsStep';
import type { Notice } from './SetupStepScreen';

// Five steps, each saved as it's left; a returning Member resumes at the first one unfinished.
// Submitting sends the phone's location when allowed, then refreshes the account stage, which
// swaps in the tabs on Discover.
export function ProfileSetupScreen() {
  const { session } = useSession();
  const userId = session!.user.id;
  const draft = useProfileDraft(userId);
  const photos = useMyPhotos();
  const refreshStage = useRefreshAccountStage();
  const [chosen, setChosen] = useState<SetupStep>();
  const [notice, setNotice] = useState<Notice>();
  // The open step's save for leaving it (Back or Android back), set by the step.
  const beforeLeave = useRef<() => Promise<void>>(undefined);
  const leaving = useRef(false);

  // Fixed at the first load, so finishing a step's minimum doesn't jump ahead by itself.
  const resumeAt = useRef<SetupStep>(undefined);
  const loaded = draft.data && photos.data;
  if (loaded && !resumeAt.current) {
    resumeAt.current = firstIncompleteStep(draft.data!, photos.data!.length);
  }
  const step = chosen ?? resumeAt.current ?? 'basics';
  const index = setupSteps.indexOf(step);
  const go = (next: SetupStep, message?: string) => {
    setNotice(message ? { message } : undefined);
    setChosen(next);
  };
  // Saves what the step holds, then steps back; a failed save keeps the Member there.
  const back =
    index > 0
      ? async () => {
          if (leaving.current) {
            return;
          }
          leaving.current = true;
          try {
            await beforeLeave.current?.();
            beforeLeave.current = undefined;
            go(setupSteps[index - 1]);
          } catch (error) {
            setNotice({ message: (error as Error).message });
          } finally {
            leaving.current = false;
          }
        }
      : undefined;

  // Android's back button takes the same way back before it would leave the app.
  const backRef = useRef(back);
  useEffect(() => {
    backRef.current = back;
  });
  useEffect(() => {
    const subscription = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        if (!backRef.current) {
          return false;
        }
        backRef.current();
        return true;
      },
    );
    return () => subscription.remove();
  }, []);

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
    beforeLeave,
    onDone: () => {
      beforeLeave.current = undefined;
      go(setupSteps[index + 1]);
    },
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
          submit={async () => {
            await submitProfile();
            await sendLocationAfterSetup(userId);
          }}
          onDone={() => refreshStage()}
          onRefused={(refusedAt, message) => go(refusedAt, message)}
        />
      );
  }
}
