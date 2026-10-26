import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Button, Input } from '../../components';
import { signOut } from '../../features/auth/api';
import { saveBasics } from '../../features/profileSetup/api';
import { basicsDone, nameMaxLength } from '../../features/profileSetup/model';
import { useUpdateDraft } from '../../features/profileSetup/queries';
import { SetupStepScreen, useNotice, type StepProps } from './SetupStepScreen';

export function BasicsStep({
  userId,
  draft,
  onDone,
  onBack,
  notice,
  beforeLeave,
  editing,
}: StepProps) {
  const updateDraft = useUpdateDraft(userId);
  const [displayName, setDisplayName] = useState(draft.displayName ?? '');
  const shownNotice = useNotice(notice, { displayName });
  async function persist() {
    await saveBasics(userId, { displayName });
    updateDraft({ displayName: displayName.trim() });
  }
  useEffect(() => {
    beforeLeave.current = persist;
  });
  const save = useMutation({ mutationFn: persist, onSuccess: onDone });

  return (
    <SetupStepScreen
      step="basics"
      editing={editing}
      title="What should we call you?"
      onBack={onBack}
      error={save.error?.message ?? shownNotice}
      onNext={() => save.mutate()}
      nextDisabled={!basicsDone({ displayName })}
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
    </SetupStepScreen>
  );
}
