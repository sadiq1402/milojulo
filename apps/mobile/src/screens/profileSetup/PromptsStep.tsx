import { useMutation } from '@tanstack/react-query';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Text, TextArea } from '../../components';
import { usePromptQuestionList } from '../../features/catalog/queries';
import { savePrompts } from '../../features/profileSetup/api';
import {
  answerMaxLength,
  promptsDone,
  type PromptAnswer,
} from '../../features/profileSetup/model';
import { useUpdateDraft } from '../../features/profileSetup/queries';
import { colors, fontFamily, fonts } from '../../theme';
import { SetupStepScreen, type StepProps } from './SetupStepScreen';

const positions = [1, 2] as const;

export function PromptsStep({
  userId,
  draft,
  onDone,
  onBack,
  notice,
}: StepProps) {
  const questions = usePromptQuestionList();
  const updateDraft = useUpdateDraft(userId);
  const saved = (position: 1 | 2) =>
    draft.prompts.find(prompt => prompt.position === position);
  const [answers, setAnswers] = useState({
    1: saved(1)?.answer ?? '',
    2: saved(2)?.answer ?? '',
  });

  // The question already answered at a position stays; otherwise the catalog's next one.
  const prompts: PromptAnswer[] | undefined = questions.data
    ? positions.map(position => ({
        position,
        questionId:
          saved(position)?.questionId ?? questions.data[position - 1]?.id,
        answer: answers[position],
      }))
    : undefined;
  const questionText = (id: number) =>
    questions.data?.find(question => question.id === id)?.label ?? '';

  const save = useMutation({
    mutationFn: () => savePrompts(userId, prompts!),
    onSuccess: () => {
      updateDraft({
        prompts: prompts!.map(p => ({ ...p, answer: p.answer.trim() })),
      });
      onDone();
    },
  });

  return (
    <SetupStepScreen
      step="prompts"
      title="Two lines that start a conversation"
      onBack={onBack}
      error={save.error?.message ?? notice}
      onNext={() => save.mutate()}
      nextDisabled={!prompts || !promptsDone(prompts)}
      saving={save.isPending}
    >
      {prompts?.map(prompt => (
        <View key={prompt.position} style={styles.field}>
          <Text variant="bodySmall" style={styles.label}>
            {questionText(prompt.questionId)}
          </Text>
          <TextArea
            accessibilityLabel={questionText(prompt.questionId)}
            placeholder="Write your answer"
            value={prompt.answer}
            onChangeText={text =>
              setAnswers(current => ({ ...current, [prompt.position]: text }))
            }
            maxLength={answerMaxLength}
          />
          <Text
            variant="bodySmall"
            color={colors.secondary}
            style={styles.counter}
            accessibilityLabel={`${prompt.answer.length} of ${answerMaxLength} characters`}
          >
            {`${prompt.answer.length} / ${answerMaxLength}`}
          </Text>
        </View>
      ))}
    </SetupStepScreen>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { fontFamily: fontFamily(fonts.text, '600') },
  counter: { textAlign: 'right' },
});
