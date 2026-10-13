import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Avatar, Button, Card, ErrorText, Icon, Text } from '../../components';
import { colors, fontFamily, fonts, sizes, spacing } from '../../theme';

// A request to answer: who sent it, then Accept and Decline (left out when it can't be answered).
export function AnswerCard({
  name,
  detail,
  tone,
  tag,
  onOpen,
  openLabel,
  children,
  error,
  answering,
  onAnswer,
  answerLabel,
  canAnswer = true,
}: {
  name: string;
  detail?: string;
  tone: number;
  tag?: ReactNode;
  onOpen?: () => void;
  openLabel?: string;
  children?: ReactNode;
  error?: string;
  answering?: boolean;
  onAnswer: (accept: boolean) => void;
  answerLabel: (verb: 'Accept' | 'Decline') => string;
  canAnswer?: boolean;
}) {
  const who = (
    <>
      <Avatar name={name} tone={tone} />
      <View style={styles.grow}>
        <Text style={styles.name} numberOfLines={1}>
          {name}
        </Text>
        {detail ? (
          <Text variant="bodySmall" color={colors.secondary}>
            {detail}
          </Text>
        ) : null}
      </View>
      {tag}
      {onOpen ? (
        <Icon
          name="chevronRight"
          size={sizes.icon.inline}
          color={colors.secondary}
        />
      ) : null}
    </>
  );
  const busy = answering !== undefined;

  return (
    <Card style={styles.card}>
      {onOpen ? (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={openLabel}
          style={[styles.who, styles.tappable]}
        >
          {who}
        </Pressable>
      ) : (
        <View style={styles.who}>{who}</View>
      )}
      {children}
      {error ? <ErrorText text={error} /> : null}
      {canAnswer ? (
        <View style={styles.actions}>
          <Button
            label="Accept"
            accessibilityLabel={answerLabel('Accept')}
            compact
            loading={answering === true}
            disabled={busy}
            onPress={() => onAnswer(true)}
            style={styles.grow}
          />
          <Button
            label="Decline"
            accessibilityLabel={answerLabel('Decline')}
            variant="secondary"
            compact
            loading={answering === false}
            disabled={busy}
            onPress={() => onAnswer(false)}
            style={styles.grow}
          />
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  who: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  tappable: { minHeight: sizes.hitArea },
  grow: { flex: 1, minWidth: 0 },
  name: { fontFamily: fontFamily(fonts.text, '600') },
  actions: { flexDirection: 'row', gap: spacing.xs },
});
