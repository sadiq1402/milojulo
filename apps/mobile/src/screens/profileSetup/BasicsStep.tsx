import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { Button, Input } from '../../components';
import { signOut } from '../../features/auth/api';
import { useAreaList } from '../../features/catalog/queries';
import { saveBasics } from '../../features/profileSetup/api';
import { basicsDone, nameMaxLength } from '../../features/profileSetup/model';
import { useUpdateDraft } from '../../features/profileSetup/queries';
import { ChoiceChips, Field } from './parts';
import { SetupStepScreen, type StepProps } from './SetupStepScreen';

export function BasicsStep({ userId, draft, onDone, notice }: StepProps) {
  const areas = useAreaList();
  const updateDraft = useUpdateDraft(userId);
  const [displayName, setDisplayName] = useState(draft.displayName ?? '');
  const [areaId, setAreaId] = useState(draft.areaId);
  const save = useMutation({
    mutationFn: () => saveBasics(userId, { displayName, areaId: areaId! }),
    onSuccess: () => {
      updateDraft({ displayName: displayName.trim(), areaId });
      onDone();
    },
  });

  return (
    <SetupStepScreen
      step="basics"
      title="What should we call you?"
      error={save.error?.message ?? notice}
      onNext={() => save.mutate()}
      nextDisabled={!basicsDone({ displayName, areaId })}
      saving={save.isPending}
      below={
        <Button label="Sign out" variant="text" onPress={() => signOut()} />
      }
    >
      <Input
        label="First name"
        placeholder="First name"
        value={displayName}
        onChangeText={setDisplayName}
        maxLength={nameMaxLength}
        autoCapitalize="words"
        autoComplete="name-given"
        textContentType="givenName"
      />
      <Field
        label="Which area are you in?"
        note="We only store your area, never your exact location."
      >
        <ChoiceChips
          options={(areas.data ?? []).map(area => ({
            value: area.id,
            label: area.label,
          }))}
          selected={areaId ? [areaId] : []}
          onToggle={setAreaId}
        />
      </Field>
    </SetupStepScreen>
  );
}
