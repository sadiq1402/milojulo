import React, {
  createContext,
  useContext,
  useState,
  type MutableRefObject,
  type ReactNode,
} from 'react';
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
  // A submit refusal that sent the Member here, or a save that failed on the way back.
  notice?: Notice;
  // The step sets what to save when the Member leaves it backwards.
  beforeLeave: MutableRefObject<(() => Promise<void>) | undefined>;
};

// Set by the Me tab's edit screen: the same steps, one at a time, saved with "Save".
export const EditingContext = createContext(false);
export const useEditing = () => useContext(EditingContext);

// A new object each time, so the same message shown twice counts as new.
export type Notice = { message: string };

// The notice, until the Member changes something on the step (`state` is what they edit).
export function useNotice(notice: Notice | undefined, state: unknown) {
  const snapshot = JSON.stringify(state);
  const [seen, setSeen] = useState({ notice, snapshot });
  if (seen.notice !== notice) {
    setSeen({ notice, snapshot });
    return notice?.message;
  }
  return seen.snapshot === snapshot ? notice?.message : undefined;
}

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
  const editing = useEditing();
  return (
    <FlowScreen
      barTitle={editing ? 'Edit profile' : 'Your profile'}
      progress={
        editing
          ? undefined
          : { step: setupSteps.indexOf(step) + 1, of: setupSteps.length }
      }
      title={title}
      intro={intro}
      onBack={onBack}
      footer={
        <>
          {error ? <ErrorText text={error} /> : null}
          <Button
            label={editing ? 'Save' : nextLabel}
            onPress={onNext}
            disabled={nextDisabled}
            loading={saving}
          />
          {editing ? null : below}
        </>
      }
    >
      {children}
    </FlowScreen>
  );
}
