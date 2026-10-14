import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Input, OptionCard, Stepper, Tag, Text } from '../../components';
import { useIndustryList } from '../../features/catalog/queries';
import { modeLabels } from '../../features/modes';
import { saveModes } from '../../features/profileSetup/api';
import {
  ageLimits,
  careerStageLabels,
  defaultAgeRange,
  distanceLimits,
  genderLabels,
  holdsDatingMode,
  modeOptions,
  modesDone,
  prefGenderLabels,
  professionMaxLength,
  type CareerStage,
  type Gender,
  type ModeFields,
} from '../../features/profileSetup/model';
import { useUpdateDraft } from '../../features/profileSetup/queries';
import { layout, spacing } from '../../theme';
import { ChoiceChips, Field, toggle } from './parts';
import { SetupStepScreen, useNotice, type StepProps } from './SetupStepScreen';

const genders = Object.keys(genderLabels) as Gender[];
const careerStages = Object.keys(careerStageLabels) as CareerStage[];

export function ModesStep({
  userId,
  draft,
  onDone,
  onBack,
  notice,
  beforeLeave,
}: StepProps) {
  const industries = useIndustryList();
  const updateDraft = useUpdateDraft(userId);
  const ages = defaultAgeRange(draft.birthDate);
  const [fields, setFields] = useState<ModeFields>({
    modes: draft.modes,
    gender: draft.gender,
    prefGenders: draft.prefGenders,
    prefAgeMin: draft.prefAgeMin ?? ages.min,
    prefAgeMax: draft.prefAgeMax ?? ages.max,
    prefMaxKm: draft.prefMaxKm ?? distanceLimits.default,
    profession: draft.profession,
    industryId: draft.industryId,
    careerStage: draft.careerStage,
  });
  const set = (changes: Partial<ModeFields>) =>
    setFields(current => ({ ...current, ...changes }));
  const dating = holdsDatingMode(fields.modes);
  const networking = fields.modes.includes('networking');
  const minAge = fields.prefAgeMin!;
  const maxAge = fields.prefAgeMax!;
  const maxKm = fields.prefMaxKm!;

  // Without a Dating Mode the preference defaults were never shown, so they aren't saved.
  const toSave: ModeFields = dating
    ? fields
    : {
        ...fields,
        gender: draft.gender,
        prefGenders: draft.prefGenders,
        prefAgeMin: draft.prefAgeMin,
        prefAgeMax: draft.prefAgeMax,
        prefMaxKm: draft.prefMaxKm,
      };
  async function persist() {
    await saveModes(userId, toSave);
    updateDraft({ ...toSave, profession: toSave.profession?.trim() || null });
  }
  useEffect(() => {
    beforeLeave.current = persist;
  });
  const save = useMutation({ mutationFn: persist, onSuccess: onDone });
  const shownNotice = useNotice(notice, fields);

  return (
    <SetupStepScreen
      step="modes"
      title="What are you open to?"
      intro="Pick one or more. You only see people whose choices overlap with yours."
      onBack={onBack}
      error={save.error?.message ?? shownNotice}
      onNext={() => save.mutate()}
      nextDisabled={!modesDone(fields)}
      saving={save.isPending}
    >
      <View style={styles.options}>
        {modeOptions.map(({ mode, description }) => (
          <OptionCard
            key={mode}
            title={modeLabels[mode]}
            description={description}
            checked={fields.modes.includes(mode)}
            onChange={() => set({ modes: toggle(fields.modes, mode) })}
            badge={
              mode === 'casual' ? (
                <Tag label="18+ · adults only" tone="warn" />
              ) : undefined
            }
          />
        ))}
      </View>

      {dating ? (
        <View style={styles.section}>
          <Text variant="h2" accessibilityRole="header">
            For Dating, Serious and Casual
          </Text>
          <Field label="Your gender">
            <ChoiceChips
              options={genders.map(g => ({ value: g, label: genderLabels[g] }))}
              selected={fields.gender ? [fields.gender] : []}
              onToggle={gender => set({ gender })}
            />
          </Field>
          <Field
            label="Who would you like to meet?"
            note="You see each other only if you both fit what the other is looking for."
          >
            <ChoiceChips
              options={genders.map(g => ({
                value: g,
                label: prefGenderLabels[g],
              }))}
              selected={fields.prefGenders}
              onToggle={g =>
                set({ prefGenders: toggle(fields.prefGenders, g) })
              }
            />
          </Field>
          <View style={styles.steppers}>
            <Stepper
              label="Youngest"
              value={String(minAge)}
              onDecrease={() => set({ prefAgeMin: minAge - 1 })}
              onIncrease={() => set({ prefAgeMin: minAge + 1 })}
              canDecrease={minAge > ageLimits.min}
              canIncrease={minAge < maxAge}
              decreaseLabel="Lower youngest age"
              increaseLabel="Raise youngest age"
            />
            <Stepper
              label="Oldest"
              value={String(maxAge)}
              onDecrease={() => set({ prefAgeMax: maxAge - 1 })}
              onIncrease={() => set({ prefAgeMax: maxAge + 1 })}
              canDecrease={maxAge > minAge}
              canIncrease={maxAge < ageLimits.max}
              decreaseLabel="Lower oldest age"
              increaseLabel="Raise oldest age"
            />
          </View>
          <Stepper
            label="How far away"
            value={`${maxKm} km`}
            onDecrease={() => set({ prefMaxKm: maxKm - distanceLimits.step })}
            onIncrease={() => set({ prefMaxKm: maxKm + distanceLimits.step })}
            canDecrease={maxKm > distanceLimits.min}
            canIncrease={maxKm < distanceLimits.max}
            decreaseLabel="Closer"
            increaseLabel="Further"
          />
        </View>
      ) : null}

      {networking ? (
        <View style={styles.section}>
          <Text variant="h2" accessibilityRole="header">
            For Networking (optional)
          </Text>
          <Input
            label="Profession"
            placeholder="For example, product designer"
            value={fields.profession ?? ''}
            onChangeText={profession => set({ profession })}
            maxLength={professionMaxLength}
          />
          <Field label="Industry">
            <ChoiceChips
              options={(industries.data ?? []).map(i => ({
                value: i.id,
                label: i.label,
              }))}
              selected={fields.industryId ? [fields.industryId] : []}
              onToggle={id =>
                set({ industryId: id === fields.industryId ? null : id })
              }
            />
          </Field>
          <Field label="Career stage">
            <ChoiceChips
              options={careerStages.map(s => ({
                value: s,
                label: careerStageLabels[s],
              }))}
              selected={fields.careerStage ? [fields.careerStage] : []}
              onToggle={stage =>
                set({
                  careerStage: stage === fields.careerStage ? null : stage,
                })
              }
            />
          </Field>
        </View>
      ) : null}
    </SetupStepScreen>
  );
}

const styles = StyleSheet.create({
  options: { gap: spacing.xs },
  section: { gap: layout.blockGap, paddingTop: spacing.xs },
  steppers: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl },
});
