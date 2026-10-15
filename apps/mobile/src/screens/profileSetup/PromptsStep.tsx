import { useMutation } from '@tanstack/react-query';
import React, { useEffect, useState } from 'react';
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
import { SetupStepScreen, useNotice, type StepProps } from './SetupStepScreen';

const positions = [1, 2] as const;

export function PromptsStep({
  userId,
  draft,
  onDone,
  onBack,
  notice,
  beforeLeave,
  editing,
}: StepProps) {
  const questions = usePromptQuestionList();
  const updateDraft = useUpdateDraft(userId);
  const saved = (position: 1 | 2) =>
    draft.prompts.find(prompt => prompt.position === position);
  const [answers, setAnswers] = useState({
    1: saved(1)?.answer ?? '',
    2: saved(2)?.answer ?? '',
  });
  const shownNotice = useNotice(notice, answers);

  // The question already answered at a position stays; otherwise the catalog's next one.
  const questionAt = (position: 1 | 2) =>
    saved(position)?.questionId ?? questions.data?.[position - 1]?.id;
  const missingQuestions =
    questions.isSuccess && positions.some(p => questionAt(p) === undefined);
  const prompts: PromptAnswer[] | undefined =
    questions.isSuccess && !missingQuestions
      ? positions.map(position => ({
          position,
          questionId: questionAt(position)!,
          answer: answers[position],
        }))
      : undefined;
  const questionText = (id: number) =>
    questions.data?.find(question => question.id === id)?.label ?? '';

  // Blank answers are left out: an empty prompt would still count toward the minimum.
  async function persist(list: PromptAnswer[]) {
    const answered = list
      .map(p => ({ ...p, answer: p.answer.trim() }))
      .filter(p => p.answer);
    if (answered.length === 0) {
      return;
    }
    await savePrompts(userId, answered);
    updateDraft({
      prompts: [
        ...draft.prompts.filter(
          p => !answered.some(a => a.position === p.position),
        ),
        ...answered,
      ].sort((a, b) => a.position - b.position),
    });
  }

  useEffect(() => {
    beforeLeave.current = async () => {
      if (prompts) {
        await persist(prompts);
      }
    };
  });

  const save = useMutation({
    mutationFn: () => persist(prompts!),
    onSuccess: onDone,
  });

  return (
    <SetupStepScreen
      step="prompts"
      editing={editing}
      title="Two lines that start a conversation"
      onBack={onBack}
      error={
        save.error?.message ??
        shownNotice ??
        (missingQuestions
          ? "Prompts aren't available right now. Try again later."
          : undefined)
      }
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
