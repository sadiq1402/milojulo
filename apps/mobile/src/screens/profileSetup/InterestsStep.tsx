import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { useTagList } from '../../features/catalog/queries';
import { saveInterests, submitProfile } from '../../features/profileSetup/api';
import {
  availabilityLabels,
  SetupError,
  type AvailabilitySlot,
  type Interests,
  type SetupStep,
} from '../../features/profileSetup/model';
import { useUpdateDraft } from '../../features/profileSetup/queries';
import { ChoiceChips, Field, toggle } from './parts';
import {
  SetupStepScreen,
  useEditing,
  useNotice,
  type StepProps,
} from './SetupStepScreen';

const slots = Object.keys(availabilityLabels) as AvailabilitySlot[];

type Props = StepProps & {
  // A submit refusal another step fixes.
  onRefused: (step: SetupStep, message: string) => void;
};

export function InterestsStep({
  userId,
  draft,
  onDone,
  onBack,
  onRefused,
  notice,
  beforeLeave,
}: Props) {
  const tags = useTagList();
  const editing = useEditing();
  const updateDraft = useUpdateDraft(userId);
  const [interests, setInterests] = useState<Interests>({
    tagIds: draft.tagIds,
    availability: draft.availability,
  });
  async function persist() {
    await saveInterests(userId, interests);
    updateDraft(interests);
  }
  useEffect(() => {
    beforeLeave.current = persist;
  });
  const shownNotice = useNotice(notice, interests);
  const submit = useMutation({
    mutationFn: async () => {
      await persist();
      // An edit of a profile already submitted only saves.
      if (!editing) {
        await submitProfile();
      }
    },
    onSuccess: onDone,
    onError: error => {
      if (!editing && error instanceof SetupError && error.step) {
        onRefused(error.step, error.message);
      }
    },
  });
  const stayingHere =
    submit.error &&
    (editing || !(submit.error instanceof SetupError && submit.error.step));

  return (
    <SetupStepScreen
      step="interests"
      title="What do you enjoy?"
      onBack={onBack}
      error={(stayingHere ? submit.error?.message : undefined) ?? shownNotice}
      nextLabel="Finish and submit"
      onNext={() => submit.mutate()}
      nextDisabled={false}
      saving={submit.isPending}
    >
      <ChoiceChips
        options={(tags.data ?? []).map(tag => ({
          value: tag.id,
          label: tag.label,
        }))}
        selected={interests.tagIds}
        onToggle={id =>
          setInterests(current => ({
            ...current,
            tagIds: toggle(current.tagIds, id),
          }))
        }
      />
      <Field label="When are you usually free?">
        <ChoiceChips
          options={slots.map(slot => ({
            value: slot,
            label: availabilityLabels[slot],
          }))}
          selected={interests.availability}
          onToggle={slot =>
            setInterests(current => ({
              ...current,
              availability: toggle(current.availability, slot),
            }))
          }
        />
      </Field>
    </SetupStepScreen>
  );
}
