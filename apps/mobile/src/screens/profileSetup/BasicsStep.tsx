import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { Button, Input, Text } from '../../components';
import { signOut } from '../../features/auth/api';
import {
  nearestAreas,
  suggestedArea,
  type NearArea,
} from '../../features/catalog/nearest';
import { useAreaList } from '../../features/catalog/queries';
import { askLocationInSetup } from '../../features/location/setup';
import { saveBasics } from '../../features/profileSetup/api';
import { basicsDone, nameMaxLength } from '../../features/profileSetup/model';
import { useUpdateDraft } from '../../features/profileSetup/queries';
import { colors } from '../../theme';
import { AreaSheet, ChosenArea, LocateCard, privacyNote } from './AreaPicker';
import { Field } from './parts';
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
  const areas = useAreaList();
  const updateDraft = useUpdateDraft(userId);
  const [displayName, setDisplayName] = useState(draft.displayName ?? '');
  const [areaId, setAreaId] = useState(draft.areaId);
  const [suggestedId, setSuggestedId] = useState<string>();
  const [near, setNear] = useState<NearArea[]>();
  const [locating, setLocating] = useState(false);
  const [picking, setPicking] = useState(false);
  const area = areas.data?.find(a => a.id === areaId);
  const shownNotice = useNotice(notice, { displayName, areaId });
  async function persist() {
    await saveBasics(userId, { displayName, areaId: areaId! });
    updateDraft({ displayName: displayName.trim(), areaId });
  }
  useEffect(() => {
    beforeLeave.current = persist;
  });
  const save = useMutation({ mutationFn: persist, onSuccess: onDone });

  // The nearest Area within a few km is chosen for the Member; otherwise, or without location,
  // the list opens with nothing chosen.
  async function locate() {
    setLocating(true);
    const point = await askLocationInSetup(userId);
    setLocating(false);
    const list = areas.data ?? [];
    if (point) {
      setNear(nearestAreas(point, list, 3));
      const suggestion = suggestedArea(point, list);
      if (suggestion) {
        setAreaId(suggestion.id);
        setSuggestedId(suggestion.id);
        return;
      }
    }
    setPicking(true);
  }

  return (
    <SetupStepScreen
      step="basics"
      editing={editing}
      title="What should we call you?"
      onBack={onBack}
      error={save.error?.message ?? shownNotice}
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
      <Field label="Which area are you in?">
        {areaId && !areas.data ? null : area ? (
          <ChosenArea
            area={area}
            suggested={area.id === suggestedId}
            onChange={() => setPicking(true)}
          />
        ) : (
          <LocateCard
            locating={locating}
            onLocate={locate}
            onChoose={() => setPicking(true)}
          />
        )}
      </Field>
      <Text variant="bodySmall" color={colors.secondary}>
        {privacyNote}
      </Text>
      <AreaSheet
        visible={picking}
        areas={areas.data ?? []}
        near={near}
        selected={areaId}
        onClose={() => setPicking(false)}
        onChoose={id => {
          setAreaId(id);
          setPicking(false);
        }}
      />
    </SetupStepScreen>
  );
}
