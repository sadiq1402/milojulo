import React, { type ReactNode } from 'react';
import { Button, ErrorText, FlowScreen } from '../../components';
import type {
  ProfileDraft,
  SetupStep,
} from '../../features/profileSetup/model';
import { setupSteps } from '../../features/profileSetup/model';

// What every step gets from the setup screen.
export type StepProps = {
  userId: string;
  draft: ProfileDraft;
  onDone: () => void;
  onBack?: () => void;
  // A submit refusal that sent the Member back to this step.
  notice?: string;
};

type Props = {
  step: SetupStep;
  title: string;
  intro?: string;
  onBack?: () => void;
  error?: string;
  nextLabel?: string;
  onNext: () => void;
  nextDisabled: boolean;
  saving: boolean;
  below?: ReactNode;
  children: ReactNode;
};

export function SetupStepScreen({
  step,
  title,
  intro,
  onBack,
  error,
  nextLabel = 'Next',
  onNext,
  nextDisabled,
  saving,
  below,
  children,
}: Props) {
  return (
    <FlowScreen
      barTitle="Your profile"
      progress={{ step: setupSteps.indexOf(step) + 1, of: setupSteps.length }}
      title={title}
      intro={intro}
      onBack={onBack}
      footer={
        <>
          {error ? <ErrorText text={error} /> : null}
          <Button
            label={nextLabel}
            onPress={onNext}
            disabled={nextDisabled}
            loading={saving}
          />
          {below}
        </>
      }
    >
      {children}
    </FlowScreen>
  );
}
